/* ==========================================================================
   ai.js — the model layer.

   Everything that needs judgement rather than pattern matching goes through
   here: reading a resume, asking the follow up questions that turn a bullet
   into a story, and rewriting a draft. One transport, three callers.

   Two ways to reach the API:
     key    the browser calls api.anthropic.com directly with a key you paste
            into Settings. It never leaves this browser, but it does sit in
            this browser, which is fine for your own testing and wrong for
            anyone else's machine.
     proxy  the browser calls a URL you host, and your server holds the key.
            This is the shape a real deployment takes.

   With neither configured the app falls back to reading resumes by pattern
   matching, which is worse and says so.
   ========================================================================== */
(function (window) {
  'use strict';

  var ENDPOINT = 'https://api.anthropic.com/v1/messages';
  var VERSION = '2023-06-01';

  var MODELS = [
    { id: 'claude-opus-5',   name: 'Opus 5',   note: 'Best at reading a messy resume' },
    { id: 'claude-sonnet-5', name: 'Sonnet 5', note: 'Faster and cheaper, still good' },
    { id: 'claude-haiku-4-5', name: 'Haiku 4.5', note: 'Cheapest. Misses things.' }
  ];

  /* ---- what a resume comes back as -------------------------------------- */
  var RESUME_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['name', 'email', 'phone', 'location', 'years', 'roles', 'wins', 'tools', 'voice'],
    properties: {
      name: { type: 'string', description: 'Their full name. Empty string if it is not in the document.' },
      email: { type: 'string' },
      phone: { type: 'string' },
      location: { type: 'string', description: 'City and state or country, as written.' },
      years: { type: 'integer', description: 'Total years of professional experience, worked out from the dates. 0 if unclear.' },
      roles: {
        type: 'array',
        description: 'Every job, most recent first.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'company', 'span', 'bullets'],
          properties: {
            title: { type: 'string' },
            company: { type: 'string', description: 'Company, and location if given.' },
            span: { type: 'string', description: 'Like "2023 to now" or "2021 to 2023".' },
            bullets: {
              type: 'array',
              description: 'What they did there, cleaned up but not reworded.',
              items: { type: 'string' }
            }
          }
        }
      },
      wins: {
        type: 'array',
        description: 'Achievements with a number attached. One per distinct result, deduplicated.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['text', 'metric', 'short', 'where', 'tags'],
          properties: {
            text: { type: 'string', description: 'The achievement in their own words.' },
            metric: { type: 'string', description: 'Just the number, formatted tight: 112%, $1.2M, 30-70, Top 3.' },
            short: { type: 'string', description: 'Five to nine words naming what the number measures, without repeating the number. Reads as a phrase: "through a pricing change", "territory ARR growth".' },
            where: { type: 'string', description: 'Company and period it happened at.' },
            tags: {
              type: 'array',
              description: 'Lowercase single words a job listing might use for this: pricing, quota, ramp, discovery, territory, enterprise, outbound, team.',
              items: { type: 'string' }
            }
          }
        }
      },
      tools: { type: 'array', description: 'Software and methodologies named.', items: { type: 'string' } },
      voice: {
        type: 'array',
        description: 'Two to four short labels for how this person writes, read off their own bullets.',
        items: { type: 'string' }
      }
    }
  };

  var RESUME_SYSTEM = [
    'You read resumes and pull out what a job seeker would use to write to a hiring manager.',
    '',
    'Rules:',
    '- Take what is on the page. Do not invent a title, a number, or a date that is not there.',
    '- A win needs a number in it. "Grew the territory" is not a win. "Grew territory ARR 41%" is.',
    '- Keep their words in text and bullets. You are extracting, not rewriting.',
    '- short must not repeat the number that is already in metric, and must read as a phrase.',
    '- If a field is not in the document, return an empty string or an empty array. Never guess.'
  ].join('\n');

  function cfg() {
    return (Store.state.ai = Store.state.ai || { mode: 'off', key: '', proxy: '', model: 'claude-opus-5' });
  }

  var AI = {
    MODELS: MODELS,
    config: cfg,

    /* is there anywhere to send a request */
    ready: function () {
      var c = cfg();
      if (c.mode === 'key') return !!(c.key && c.key.trim());
      if (c.mode === 'proxy') return !!(c.proxy && c.proxy.trim());
      return false;
    },
    describe: function () {
      var c = cfg();
      if (c.mode === 'key') return 'Claude ' + (AI.modelName(c.model)) + ', called from this browser';
      if (c.mode === 'proxy') return 'Claude ' + (AI.modelName(c.model)) + ', through your server';
      return 'Pattern matching, no model';
    },
    modelName: function (id) {
      var m = MODELS.filter(function (x) { return x.id === id; })[0];
      return m ? m.name : id;
    },

    /* ---- the one request ------------------------------------------------- */
    send: function (opts) {
      var c = cfg();
      if (!AI.ready()) return Promise.reject(new Error('not configured'));

      var body = {
        model: c.model || 'claude-opus-5',
        max_tokens: opts.maxTokens || 8000,
        messages: opts.messages
      };
      if (opts.system) body.system = opts.system;
      if (opts.schema) body.output_config = { format: { type: 'json_schema', schema: opts.schema } };

      var url = c.mode === 'proxy' ? c.proxy.trim() : ENDPOINT;
      var headers = { 'content-type': 'application/json' };
      if (c.mode === 'key') {
        headers['x-api-key'] = c.key.trim();
        headers['anthropic-version'] = VERSION;
        /* the API blocks browser origins unless you say you meant it */
        headers['anthropic-dangerous-direct-browser-access'] = 'true';
      }

      var doFetch = window.AI_FETCH || window.fetch.bind(window);
      return doFetch(url, { method: 'POST', headers: headers, body: JSON.stringify(body) })
        .then(function (res) {
          return res.text().then(function (raw) {
            var data = null;
            try { data = JSON.parse(raw); } catch (e) {}
            if (!res.ok) {
              var msg = (data && data.error && data.error.message) || raw.slice(0, 160) || ('HTTP ' + res.status);
              if (res.status === 401) msg = 'That key was rejected.';
              if (res.status === 429) msg = 'Rate limited. Wait a moment and try again.';
              throw new Error(msg);
            }
            if (!data) throw new Error('The response was not JSON.');
            if (data.stop_reason === 'refusal') throw new Error('The model declined that one.');
            /* thinking blocks come first on the current models */
            var text = (data.content || []).filter(function (b) { return b.type === 'text'; })
              .map(function (b) { return b.text; }).join('');
            if (!text) throw new Error('The model returned nothing to use.');
            if (!opts.schema) return text;
            try { return JSON.parse(text); }
            catch (e) { throw new Error('The model did not return the shape we asked for.'); }
          });
        });
    },

    /* ---- reading a resume ------------------------------------------------ */
    readResume: function (text) {
      return AI.send({
        system: RESUME_SYSTEM,
        schema: RESUME_SCHEMA,
        maxTokens: 8000,
        messages: [{ role: 'user', content: 'Here is the resume:\n\n<resume>\n' + text + '\n</resume>' }]
      });
    },

    /* ---- fetching a posting from its link --------------------------------
       A browser cannot read another site's page: the job boards do not send
       CORS headers, so fetch() from here is refused before it starts. The
       model's server side web fetch does the reading instead. It cannot run
       JavaScript, so sites that render their listing client side, and sites
       behind a login, still come back empty and say so. ------------------- */
    postingErrors: {
      url_not_accessible: 'That page would not load. Job boards often block anything that is not a browser, and anything behind a login is out of reach.',
      url_not_allowed: 'That address is not one we are allowed to fetch.',
      url_not_in_prior_context: 'The link did not make it through. Try pasting it again.',
      url_too_long: 'That link is too long to fetch.',
      invalid_tool_input: 'That does not look like a web address.',
      unsupported_content_type: 'We can read web pages and PDFs, nothing else.',
      too_many_requests: 'Rate limited. Give it a minute.',
      max_uses_exceeded: 'Gave up after two tries.',
      unavailable: 'The fetch failed on their end.'
    },

    fetchPosting: function (url) {
      var c = cfg();
      if (!AI.ready()) return Promise.reject(new Error('not configured'));

      var sys = [
        'You are given a link to a job posting. Fetch it and return the posting as plain text.',
        '',
        'Return the posting only. Start with the job title, then a line with the company, location',
        'and any requisition number. Then the body, keeping the responsibilities and requirements as',
        'the bullet list they already are. Drop the site navigation, the cookie notice, the "apply',
        'now" furniture, the benefits boilerplate and anything about other roles.',
        '',
        'Do not summarise, do not comment, do not add a preamble. If the page is not a job posting,',
        'or the text is not there, reply with exactly: NOT_A_POSTING'
      ].join('\n');

      var body = {
        model: c.model || 'claude-opus-5',
        max_tokens: 4000,
        system: sys,
        messages: [{ role: 'user', content: 'Here is the posting: ' + url }],
        tools: [{
          type: 'web_fetch_20250910',
          name: 'web_fetch',
          max_uses: 2,
          max_content_tokens: 20000
        }]
      };

      var url2 = c.mode === 'proxy' ? c.proxy.trim() : ENDPOINT;
      var headers = { 'content-type': 'application/json' };
      if (c.mode === 'key') {
        headers['x-api-key'] = c.key.trim();
        headers['anthropic-version'] = VERSION;
        headers['anthropic-dangerous-direct-browser-access'] = 'true';
      }

      var doFetch = window.AI_FETCH || window.fetch.bind(window);
      return doFetch(url2, { method: 'POST', headers: headers, body: JSON.stringify(body) })
        .then(function (res) {
          return res.text().then(function (raw) {
            var data = null;
            try { data = JSON.parse(raw); } catch (e) {}
            if (!res.ok) {
              var m = (data && data.error && data.error.message) || ('HTTP ' + res.status);
              if (res.status === 401) m = 'That key was rejected.';
              throw new Error(m);
            }
            if (!data) throw new Error('The response was not JSON.');

            /* a failed fetch comes back as a 200 with an error block in it */
            var blocks = data.content || [];
            var result = blocks.filter(function (b) { return b.type === 'web_fetch_tool_result'; })[0];
            if (result && result.content && result.content.type === 'web_fetch_tool_result_error') {
              throw new Error(AI.postingErrors[result.content.error_code] || 'The fetch failed.');
            }
            if (!result) throw new Error('The model did not try to fetch that link.');

            var text = blocks.filter(function (b) { return b.type === 'text'; })
              .map(function (b) { return b.text; }).join('\n').trim();
            if (!text || /NOT_A_POSTING/.test(text)) {
              throw new Error('There was no job posting on that page. Sites that build the listing in the browser, LinkedIn among them, come back blank.');
            }
            return { text: text, url: (result.content && result.content.url) || url };
          });
        });
    },

    /* ---- line the listing up against the resume -------------------------- */
    matchListing: function (listing, requirements) {
      var wins = Store.state.profile.wins.map(function (w) {
        return w.id + ': ' + w.text + ' (' + (w.where || 'no date') + ')';
      }).join('\n');
      var roles = Store.state.profile.roles.map(function (r) {
        return '- ' + r.title + ', ' + r.company + ', ' + r.span + ': ' + r.bullets.join('; ');
      }).join('\n');

      var sys = [
        'You compare a job listing against one person\u2019s resume and say, line by line, where they',
        'line up and where they do not.',
        '',
        'For every requirement the listing states, find the evidence on the resume and name it by id.',
        'strong means the resume shows they have done this, with something concrete. partial means it',
        'is adjacent or implied. none means there is nothing there, and you must say none rather than',
        'stretch: an honest gap is the useful part of this.',
        '',
        'note is one short line, under 15 words, saying what the evidence actually is or what is',
        'missing. Do not repeat the requirement back.',
        '',
        'leadWith is the three win ids that answer the most important requirements. Exactly three,',
        'or fewer only if there are fewer wins.'
      ].join('\n');

      var schema = {
        type: 'object',
        additionalProperties: false,
        required: ['requirements', 'leadWith'],
        properties: {
          requirements: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['text', 'priority', 'winIds', 'strength', 'note'],
              properties: {
                text: { type: 'string', description: 'The requirement, as the listing puts it, trimmed.' },
                priority: { type: 'string', enum: ['must', 'nice'] },
                winIds: { type: 'array', items: { type: 'string' }, description: 'Ids of the wins that evidence this. Empty when there is none.' },
                strength: { type: 'string', enum: ['strong', 'partial', 'none'] },
                note: { type: 'string' }
              }
            }
          },
          leadWith: { type: 'array', items: { type: 'string' }, description: 'Three win ids.' }
        }
      };

      return AI.send({
        system: sys,
        schema: schema,
        maxTokens: 4000,
        messages: [{
          role: 'user',
          content: 'The listing:\n<listing>\n' + listing + '\n</listing>\n\n' +
            'Their wins, by id:\n' + wins + '\n\nTheir roles:\n' + roles +
            (requirements && requirements.length
              ? '\n\nRequirements we already pulled out, if useful:\n- ' + requirements.join('\n- ')
              : '')
        }]
      });
    },

    /* ---- the conversation that fills the gaps ---------------------------- */
    prepTurn: function (campaign, item, history) {
      var sys = [
        'You are helping someone get ready to apply for a specific job. You work through one thing at',
        'a time and you are after detail a resume bullet cannot hold: what broke, what they did, in',
        'what order, what it cost, how it ended, and the number if there is one.',
        '',
        'Ask ONE question per message. Under 25 words. No preamble, no flattery, no summarising back',
        'at length. If their answer is vague, ask the sharper version of the same question rather than',
        'moving on. Two or three exchanges on one item is usually enough.',
        '',
        'When you have something they could actually say out loud to a hiring manager, put it in story',
        'as three or four sentences in their own voice, first person, past tense, and set complete to',
        'true. Until then story is an empty string and complete is false.',
        '',
        'If the item is a gap, something the listing wants that their resume does not show, do not',
        'invent coverage. Look for the nearest real thing they have done and say plainly if there is',
        'nothing. A gap they can speak to honestly beats a gap they have papered over.'
      ].join('\n');

      var head = 'Job: ' + campaign.role + ' at ' + campaign.company + '.\n' +
        (item.kind === 'gap'
          ? 'This is a gap. The listing asks for: "' + item.label + '". Their resume does not show it.'
          : 'They are leading with this win: "' + item.label + '". Get the story behind it.');

      return AI.send({
        system: sys,
        maxTokens: 900,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['reply', 'story', 'complete'],
          properties: {
            reply: { type: 'string', description: 'What you say next. One question, under 25 words, unless you are done.' },
            story: { type: 'string', description: 'The finished story in their voice, or an empty string.' },
            complete: { type: 'boolean' }
          }
        },
        messages: [{ role: 'user', content: head }].concat(history)
      });
    },

    /* ---- the questions that turn a bullet into a story ------------------- */
    storyTurn: function (campaign, win, history) {
      var sys = [
        'You are helping a job seeker turn one achievement from their resume into a story they can',
        'tell a hiring manager. Ask one short question at a time. Three or four in total, then stop.',
        '',
        'Ask about what actually happened: what broke, what they did, what it cost, how it ended.',
        'Never ask more than one thing in a message. Never flatter them. Never summarise back to',
        'them at length. Keep every message under 25 words.',
        '',
        'When you have enough, say so in one line and stop asking.'
      ].join('\n');

      var intro = 'They are applying for ' + campaign.role + ' at ' + campaign.company + '.' +
        (win ? ' They are leading with: "' + win.text + '".' : '');

      return AI.send({
        system: sys,
        maxTokens: 400,
        messages: [{ role: 'user', content: intro }].concat(history)
      });
    },

    /* pull the answers together into something the page can print */
    storySummary: function (campaign, win, history) {
      var sys = 'Write what the person told you as three or four plain sentences, in their voice, ' +
        'first person, past tense. No preamble, no heading, no flourish. Only what they said.';
      return AI.send({
        system: sys,
        maxTokens: 500,
        messages: history.concat([{ role: 'user', content: 'Write it up now, nothing else.' }])
      });
    },

    /* ---- rewriting a draft ----------------------------------------------- */
    rewrite: function (ask, draft, campaign, contact) {
      var sys = [
        'You edit one outreach message at a time for a job seeker. You get the current draft and',
        'what they want changed. Return the whole message rewritten, and one short line saying what',
        'you did.',
        '',
        'Hold to this: no greeting beyond their first name, no "I hope this finds you well", no',
        'adjectives doing the work of facts, one ask at the end. Keep any real number that is already',
        'there. Never invent a number, a name, or a claim that is not in the draft.'
      ].join('\n');

      var ctx = 'Company: ' + campaign.company + '\nRole: ' + campaign.role +
        (contact ? '\nGoing to: ' + contact.name + ', ' + (contact.title || contact.persona) : '') +
        '\n\nCurrent draft:\n' + draft + '\n\nWhat they want: ' + ask;

      return AI.send({
        system: sys,
        maxTokens: 2000,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['reply', 'body'],
          properties: {
            reply: { type: 'string', description: 'One line, under 12 words, saying what you changed.' },
            body: { type: 'string', description: 'The full rewritten message.' }
          }
        },
        messages: [{ role: 'user', content: ctx }]
      });
    },

    /* ---- settings -------------------------------------------------------- */
    test: function () {
      return AI.send({
        maxTokens: 16,
        messages: [{ role: 'user', content: 'Reply with the single word: ready' }]
      });
    }
  };

  window.AI = AI;
})(window);
