'use strict';

const Search = {
  isOpen: false,
  found: [],
  active: 0,
  groups: ['Предметы', 'Конспекты', 'ДЗ', 'Работы', 'Преподаватели', 'Новости'],
  /**
   * Собирает всё, что можно найти: предметы, конспекты, ДЗ, работы, преподавателей, новости.
   * @returns {Array<Object>} Массив.
   */
  collect() {
    const store = Store.s,
      list = [],
      teacher = Cloud.isStaff;
    store.subjects.forEach(x =>
      list.push({
        group: 'Предметы',
        title: x.name,
        text: x.short || '',
        sub: '',
        go: {
          type: 'subject',
          id: x.id
        }
      })
    );
    store.notes.forEach(n =>
      list.push({
        group: 'Конспекты',
        title: n.title || 'Без заголовка',
        text: n.text || '',
        sub: (subj(n.subjectId) || {}).short || 'Личная',
        go: {
          type: 'note',
          id: n.id
        }
      })
    );
    if (!teacher) {
      store.homework.forEach(h =>
        list.push({
          group: 'ДЗ',
          title: h.text,
          text: '',
          sub: (subj(h.subjectId) || {}).short || '',
          go: {
            type: 'hw'
          }
        })
      );
      allWorks().forEach(w =>
        list.push({
          group: 'Работы',
          title: w.title,
          text: w.type || '',
          sub: shortDate(w.date),
          go: {
            type: 'work'
          }
        })
      );
      store.teachers.forEach(t =>
        list.push({
          group: 'Преподаватели',
          title: t.name,
          text: t.notes || '',
          sub: '',
          go: {
            type: 'teacher'
          }
        })
      );
    }
    News.items.forEach(n =>
      list.push({
        group: 'Новости',
        title: n.title,
        text: n.body,
        sub: '',
        go: {
          type: 'news'
        }
      })
    );
    return list;
  },
  /**
   * Ищет по всем словам запроса и сортирует по группам и важности.
   * @param {string} query Текст запроса.
   * @returns {Array<Object>} Массив.
   */
  find(query) {
    const words = U.norm(query).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const scored = [];
    Search.collect().forEach(item => {
      const title = U.norm(item.title),
        text = U.norm(item.text + ' ' + item.sub);
      if (!words.every(w => title.indexOf(w) >= 0 || text.indexOf(w) >= 0)) return;
      const score = (title.indexOf(words[0]) === 0 ? 3 : 0) + (words.every(w => title.indexOf(w) >= 0) ? 2 : 0) + 1;
      scored.push({
        item,
        score
      });
    });
    const perGroup = {};
    return scored
      .sort((a, b) => Search.groups.indexOf(a.item.group) - Search.groups.indexOf(b.item.group) || b.score - a.score)
      .filter(x => (perGroup[x.item.group] = (perGroup[x.item.group] || 0) + 1) <= 5)
      .map(x => x.item);
  },
  /**
   * Подсвечивает найденные слова в тексте.
   * @param {string} text Исходный текст.
   * @param {string} query Текст запроса.
   * @returns {string} HTML.
   */
  highlight(text, query) {
    const safe = U.esc(String(text).slice(0, 140));
    const words = U.norm(query)
      .split(/\s+/)
      .filter(w => w.length > 0)
      .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return words.length ? safe.replace(new RegExp('(' + words.join('|') + ')', 'gi'), '<mark>$1</mark>') : safe;
  },
  /**
   * Перерисовывает список результатов поиска.
   */
  render() {
    const input = document.getElementById('palette-input'),
      list = document.getElementById('palette-list');
    if (!input || !list) return;
    const query = input.value;
    Search.found = Search.find(query);
    Search.active = Math.min(Search.active, Math.max(0, Search.found.length - 1));
    if (!query.trim()) {
      list.innerHTML = '<p class="palette-hint">Начните вводить: предмет, конспект, ДЗ, преподаватель или новость.</p>';
      return;
    }
    if (!Search.found.length) {
      list.innerHTML = '<p class="palette-hint">Ничего не найдено. Попробуйте другое слово.</p>';
      return;
    }
    let html = '',
      group = '';
    Search.found.forEach((item, i) => {
      if (item.group !== group) {
        group = item.group;
        html += '<div class="palette-group">' + U.esc(group) + '</div>';
      }
      html +=
        '<button class="palette-item' +
        (i === Search.active ? ' on' : '') +
        '" role="option" data-index="' +
        i +
        '"><b>' +
        Search.highlight(item.title, query) +
        '</b>' +
        (item.sub ? '<small>' + U.esc(item.sub) + '</small>' : '') +
        '</button>';
    });
    list.innerHTML = html;
    const current = list.querySelector('.palette-item.on');
    if (current && current.scrollIntoView)
      current.scrollIntoView({
        block: 'nearest'
      });
  },
  /**
   * Открывает окно поиска.
   */
  open() {
    if (Search.isOpen || document.body.classList.contains('gated')) return;
    Search.isOpen = true;
    const root = document.createElement('div');
    root.id = 'palette';
    root.className = 'overlay palette-overlay';
    root.innerHTML =
      '<div class="palette" role="dialog" aria-label="Поиск"><input id="palette-input" class="input" type="search" placeholder="Найти предмет, конспект, ДЗ, преподавателя" autocomplete="off" spellcheck="false">' +
      '<div id="palette-list" class="palette-list" role="listbox"></div><div class="palette-foot"><span>↑↓ выбрать</span><span>Enter открыть</span><span>Esc закрыть</span></div></div>';
    document.body.appendChild(root);
    Search.active = 0;
    Search.render();
    root.querySelector('input').focus();
  },
  /**
   * Закрывает окно поиска.
   */
  close() {
    const root = document.getElementById('palette');
    if (root) root.remove();
    Search.isOpen = false;
  },
  /**
   * Двигает выбор по результатам стрелками.
   * @param {number} step На сколько позиций сдвинуть выбор.
   */
  move(step) {
    if (!Search.found.length) return;
    Search.active = (Search.active + step + Search.found.length) % Search.found.length;
    Search.render();
  },
  /**
   * Открывает выбранный результат.
   * @param {number} index Номер результата (необязательно).
   */
  choose(index) {
    const item = Search.found[index == null ? Search.active : index];
    if (!item) return;
    Search.close();
    const go = item.go;
    if (go.type === 'note') {
      openNoteReader(go.id);
      return;
    }
    if (go.type === 'subject') {
      ui.tab = Roles.allows('subjects') ? 'subjects' : 'schedule';
      ui.subjectId = go.id;
    } else if (go.type === 'hw') ui.tab = 'hw';
    else if (go.type === 'work') ui.tab = 'dashboard';
    else if (go.type === 'teacher') ui.tab = 'teachers';
    else if (go.type === 'news') ui.tab = 'news';
    App.render(true);
    window.scrollTo(0, 0);
  },
  /**
   * Подключает горячие клавиши и клики поиска (Cmd+K или Ctrl+K).
   */
  bind() {
    document.addEventListener('keydown', event => {
      if ((event.metaKey || event.ctrlKey) && String(event.key).toLowerCase() === 'k') {
        event.preventDefault();
        if (Search.isOpen) Search.close();
        else Search.open();
        return;
      }
      if (!Search.isOpen) return;
      if (event.key === 'Escape') Search.close();
      else if (event.key === 'ArrowDown') {
        event.preventDefault();
        Search.move(1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        Search.move(-1);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        Search.choose();
      }
    });
    document.addEventListener('input', event => {
      if (event.target && event.target.id === 'palette-input') {
        Search.active = 0;
        Search.render();
      }
    });
    document.addEventListener('click', event => {
      if (!Search.isOpen) return;
      const item = event.target.closest ? event.target.closest('.palette-item') : null;
      if (item) Search.choose(+item.dataset.index);
      else if (event.target.id === 'palette') Search.close();
    });
    const top = document.querySelector('.topbar [data-action="search-open"]');
    if (top) top.textContent = ICONS.magnifier;
    const hint = document.querySelector('.side-search kbd');
    if (hint) hint.textContent = /Mac|iPhone|iPad/.test(navigator.platform || '') ? 'Cmd K' : 'Ctrl K';
  }
};
Search.bind();
