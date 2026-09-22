/* ==========================================================================
   views/auth.js — sign in and sign up
   No backend. Any email with a password of six characters or more gets in.
   ========================================================================== */
(function (window, document) {
  'use strict';

  var esc = UI.esc;

  function aside() {
    return '' +
      '<aside class="auth-aside">' +
        '<blockquote>"I stopped applying to forty companies and picked four. Two of them called me back in the same week."</blockquote>' +
        '<div class="by"><span class="avatar avatar-md" style="background:var(--p-recruiter)">RT</span>' +
          '<span><b style="color:var(--ink)">Rachel Tam</b><br>Enterprise AE, hired at Segment</span></div>' +
        '<hr class="divider">' +
        '<div class="stat-row">' +
          '<div><b>8&times;</b><span>More likely to be hired than an inbound applicant</span></div>' +
          '<div><b>242</b><span>Applications the average opening now gets</span></div>' +
          '<div><b>5</b><span>People per company. That is the whole method</span></div>' +
        '</div>' +
      '</aside>';
  }

  function render(mode) {
    var signup = mode === 'signup';
    var root = document.getElementById('root');
    root.className = '';
    root.innerHTML =
      '<div class="auth">' +
        '<div class="auth-main"><div class="auth-box">' +
          '<div class="brand"><span class="glyph"></span><b>Frontdoor</b></div>' +
          '<h1>' + (signup ? 'Start with one company' : 'Welcome back') + '</h1>' +
          '<p class="sub">' + (signup
            ? 'Pick a company you actually want to work at. We will build the rest around it.'
            : 'Pick up where you left off with Acme.') + '</p>' +
          '<form id="auth-form" novalidate>' +
            (signup ? '<div class="field"><label for="f-name">Your name</label>' +
              '<input class="input" id="f-name" value="Evan Pogue" autocomplete="name"></div>' : '') +
            '<div class="field"><label for="f-email">Work email</label>' +
              '<input class="input" id="f-email" type="email" value="evan@example.com" autocomplete="email" spellcheck="false"></div>' +
            '<div class="field">' +
              '<div class="row between"><label for="f-pass">Password</label>' +
                (signup ? '' : '<a href="#/login" class="hint" onclick="return false">Forgot it?</a>') + '</div>' +
              '<input class="input" id="f-pass" type="password" value="demo1234" autocomplete="current-password">' +
              '<p class="err-txt hide" id="f-err">That password is under six characters.</p>' +
            '</div>' +
            '<button class="btn btn-primary btn-lg btn-block" id="f-submit" type="submit">' +
              (signup ? 'Create account' : 'Sign in') + '</button>' +
          '</form>' +
          '<div class="auth-alt">or</div>' +
          '<button class="btn btn-secondary btn-lg btn-block" id="f-google">Continue with Google</button>' +
          '<div class="demo-note">Nothing here talks to a server yet. Any email works, and the password just has to be six characters. <b>Everything you do is saved in this browser.</b></div>' +
          '<p class="auth-foot">' + (signup
            ? 'Already have an account? <a href="#/login">Sign in</a>'
            : 'No account yet? <a href="#/signup">Create one</a>') + '</p>' +
        '</div></div>' +
        aside() +
      '</div>';

    var form = document.getElementById('auth-form');
    var pass = document.getElementById('f-pass');
    var email = document.getElementById('f-email');
    var err = document.getElementById('f-err');

    function submit(btn) {
      if (pass.value.length < 6) {
        pass.classList.add('err');
        err.classList.remove('hide');
        pass.focus();
        return;
      }
      pass.classList.remove('err');
      err.classList.add('hide');
      UI.busy(btn, 750).then(function () {
        Store.signIn(email.value.trim());
        if (signup) { UI.toast('Welcome. Start with your resume.'); Router.go('/import'); return; }
        Store.createSeedCampaign();
        UI.toast('Signed in. Acme is waiting for you.');
        Router.go('/');
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submit(document.getElementById('f-submit'));
    });
    pass.addEventListener('input', function () {
      this.classList.remove('err');
      err.classList.add('hide');
    });
    document.getElementById('f-google').addEventListener('click', function () {
      var b = this;
      UI.busy(b, 850).then(function () {
        Store.signIn(email.value.trim());
        if (signup) { UI.toast('Welcome. Start with your resume.'); Router.go('/import'); return; }
        Store.createSeedCampaign();
        UI.toast('Signed in with Google.');
        Router.go('/');
      });
    });
  }

  window.Views = window.Views || {};
  window.Views.login  = function () { render('login'); };
  window.Views.signup = function () { render('signup'); };
})(window, document);
