/* ==========================================================================
   views/auth.js — sign in and sign up
   No backend. Any email with a password of six characters or more gets in.
   ========================================================================== */
(function (window, document) {
  'use strict';

  var esc = UI.esc;

  /* No testimonial and no statistics: this product has not shipped, so it
     has neither. The aside says what the product does, in the order it
     does it, and nothing it cannot stand behind. */
  function aside() {
    var steps = ['Role', 'Story', 'People', 'Outreach', 'Interview'];
    return '' +
      '<aside class="auth-aside">' +
        '<div class="auth-mark">' + Icon.mark(40) + '</div>' +
        '<p class="auth-line">One company at a time. In through the front.</p>' +
        '<ol class="auth-steps">' + steps.map(function (t, i) {
          return '<li><span class="auth-n">' + (i + 1) + '</span>' + t + '</li>';
        }).join('') + '</ol>' +
        '<p class="auth-local">Everything stays in this browser.</p>' +
      '</aside>';
  }

  function render(mode) {
    var signup = mode === 'signup';
    var root = document.getElementById('root');
    root.className = '';
    root.innerHTML =
      '<div class="auth">' +
        '<div class="auth-main"><div class="auth-box">' +
          '<div class="brand">' + Icon.mark(26) + '<b>Frontdoor</b></div>' +
          '<h1>' + (signup ? 'Create account' : 'Sign in') + '</h1>' +
          '<form id="auth-form" novalidate>' +
            (signup ? '<div class="field"><label for="f-name">Name</label>' +
              '<input class="input" id="f-name" autocomplete="name" placeholder="Your name"></div>' : '') +
            '<div class="field"><label for="f-email">Email</label>' +
              '<input class="input" id="f-email" type="email" autocomplete="email" spellcheck="false" placeholder="you@company.com"></div>' +
            '<div class="field"><label for="f-pass">Password</label>' +
              '<input class="input" id="f-pass" type="password" autocomplete="' + (signup ? 'new-password' : 'current-password') + '">' +
              '<p class="err-txt hide" id="f-err">Six characters or more.</p>' +
            '</div>' +
            '<button class="btn btn-primary btn-lg btn-block" id="f-submit" type="submit">' +
              (signup ? 'Create account' : 'Sign in') + '</button>' +
          '</form>' +
          '<p class="auth-foot">' + (signup
            ? 'Already have an account? <a href="#/login">Sign in</a>'
            : 'No account? <a href="#/signup">Create one</a>') + '</p>' +
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
      var nameEl = document.getElementById('f-name');
      UI.busy(btn, 500).then(function () {
        Store.signIn(email.value.trim(), nameEl ? nameEl.value.trim() : '');
        Router.go(Store.state.profile.imported ? '/' : '/import');
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
  }

  window.Views = window.Views || {};
  window.Views.login  = function () { render('login'); };
  window.Views.signup = function () { render('signup'); };
})(window, document);
