'use strict';

try {
  var savedTheme = window.localStorage.getItem('politeshik:theme');
  if (!savedTheme) {
    var saved = JSON.parse(window.localStorage.getItem('studyPlanner') || 'null');
    if (saved && saved.settings) savedTheme = saved.settings.theme;
  }
  if (
    savedTheme &&
    /^(light|dark|barbie|ocean|space|garden|magic|autumn|winter|valentine|defender|womens)$/.test(savedTheme)
  ) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  }
} catch (e) {}
