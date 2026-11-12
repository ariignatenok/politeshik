'use strict';
// Curator groups are read through a dedicated authorized projection. Global tenant/admin context is never switched.
const Curator = {
  owner: null,
  tenant: null,
  month: '',
  date: '',
  bundle: null,
  loading: false,
  error: '',
  token: 0,
  timer: null,
  feed: null,
  feedLoading: false,
  feedError: '',
  feedAt: 0,
  week: null,
  context() {return Cloud.facultyContext?.active?Cloud.facultyContext:Cloud.curatorContext;},
  enabled() {
    return (
      (Cloud.isCurator === true || Cloud.isTeacher === true) &&
      Cloud.member?.status === 'approved' &&
      Curator.context()?.active === true
    );
  },
  reset() {
    if (Curator.owner === Cloud.uid) return;
    Curator.owner = Cloud.uid;
    Curator.tenant = Curator.context()?.groups?.[0]?.tenant_id || null;
    Curator.month = U.iso(U.today()).slice(0, 7);
    Curator.date = U.iso(U.today());
    Curator.bundle = null;
    Curator.feed = null;
    Curator.feedAt = 0;
    Curator.error = '';
    Curator.feedError = '';
    Curator.loading = false;
    Curator.token++;
    Curator.week = U.iso(U.mondayOf(U.today()));
  },
  ensure() {
    Curator.reset();
    if (!Curator.bundle && !Curator.loading && !Curator.error) Curator.load();
    if (!Curator.timer)
      Curator.timer = setInterval(() => {
        if (
          Curator.enabled() &&
          !document.hidden &&
          ui.tab === 'schedule' &&
          Date.now() - Curator.feedAt > 300000
        )
          Curator.loadFeed();
        if (
          Curator.enabled() &&
          !document.hidden &&
          ['tdash', 'journal', 'tstudents', 'news'].includes(ui.tab) &&
          !document.querySelector('#modal-root')?.firstChild
        )
          Curator.load();
      }, 60000);
  },
  async load() {
    if (!Curator.enabled() || Curator.loading || !Curator.tenant) return;
    Curator.loading = true;
    const owner = Cloud.uid,
      tenant = Curator.tenant,
      month = Curator.month,
      token = ++Curator.token;
    try {
      const {data, error} = await supa.rpc(Cloud.facultyContext?.active?'faculty_group_view':'curator_group_view', {
        p_tenant: tenant,
        p_month: month,
      });
      if (error) throw error;
      if (owner !== Cloud.uid || token !== Curator.token) return;
      Curator.bundle = data;
      Curator.error = '';
    } catch (error) {
      if (owner === Cloud.uid && token === Curator.token) {
        Curator.error = error.message;
        Curator.bundle = null;
      }
    } finally {
      if (token === Curator.token) {
        Curator.loading = false;
        App.renderSoft();
      }
    }
  },
  select(tenant) {
    if (!Curator.context()?.groups.some((g) => g.tenant_id === tenant)) return;
    Curator.token++;
    Curator.loading = false;
    Curator.tenant = tenant;
    Curator.bundle = null;
    Curator.error = '';
    Curator.load();
    App.render();
  },
  status(student, date, pair) {
    const raw = student.marks?.[date + '|' + pair] || '',
      covered = (student.certs || []).some(
        (c) =>
          c.confirmed &&
          c.from <= date &&
          c.to >= date &&
          (!c.pairs?.length || c.pairs.includes(pair)),
      );
    return raw === 'у' ? 'уп' : covered && (!raw || raw === 'н') ? 'уп' : raw;
  },
  stats(student) {
    const count = {п: 0, о: 0, н: 0, уп: 0};
    for (const key of Object.keys(student.marks || {})) {
      const [date, pair] = key.split('|'),
        st = Curator.status(student, date, Number(pair));
      if (st in count) count[st]++;
    }
    const marked = count.п + count.о + count.н;
    return {...count, pct: marked ? Math.round(((count.п + count.о) * 100) / marked) : null};
  },
  controls() {
    return (
      '<div class="curator-controls"><label>Моя группа<select class="input" data-curator="group">' +
      Curator.context().groups
        .map(
          (g) =>
            '<option value="' +
            g.tenant_id +
            '"' +
            (g.tenant_id === Curator.tenant ? ' selected' : '') +
            '>' +
            U.esc(g.number) +
            '</option>',
        )
        .join('') +
      '</select></label><label>Месяц<input class="input" type="month" data-curator="month" value="' +
      Curator.month +
      '"></label><button class="btn" data-action="curator-refresh"' +
      (Curator.loading ? ' disabled' : '') +
      '>Обновить</button></div><p class="hint">Просмотр закреплённых групп. Отметки и подтверждения справок ведут старосты и Админ Арина.</p>'
    );
  },
  view(tab) {
    Curator.ensure();
    if (tab === 'schedule') return Curator.scheduleView();
    const titles = {
      tdash: Cloud.facultyContext?.active?'Кабинет преподавателя':'Кабинет куратора',
      journal: 'Журнал группы',
      tstudents: 'Студенты моих групп',
      news: 'Новости группы',
    };
    let html =
      '<div class="page-head"><div><h1>' +
      titles[tab] +
      '</h1><p>' +
      U.esc(Curator.context().name) +
      '</p></div></div>';
    if (tab === 'tdash')
      html +=
        '<div class="curator-group-cards">' +
        Curator.context().groups
          .map(
            (g) =>
              '<button class="card' +
              (g.tenant_id === Curator.tenant ? ' on' : '') +
              '" data-action="curator-group" data-tenant="' +
              g.tenant_id +
              '"><b>' +
              U.esc(g.number) +
              '</b><span>' +
              g.students +
              ' студентов в списке</span></button>',
          )
          .join('') +
        '</div>';
    if(!Curator.context().groups.length)return html+'<section class="card">В расписании добавленных групп ваших занятий пока нет. Личное расписание доступно в разделе «Расписание».</section>';
    html += Curator.controls();
    if (Curator.error) return html + '<p class="warn">' + U.esc(Curator.error) + '</p>';
    if (!Curator.bundle)
      return html + '<section class="card" role="status">Загружаем данные группы…</section>';
    const students = Curator.bundle.students || [],
      registered = students.filter((s) => s.registered),
      stats = registered.map(Curator.stats);
    if (tab === 'tdash') {
      const absent = stats.reduce((sum, s) => sum + s.н, 0),
        attention = registered.filter((s) => {
          const st = Curator.stats(s);
          return st.pct !== null && st.pct < 70;
        });
      return (
        html +
        '<div class="grid-stats curator-stats"><div class="stat"><b>' +
        students.length +
        '</b><small>в списке группы</small></div><div class="stat"><b>' +
        registered.length +
        '</b><small>зарегистрированы</small></div><div class="stat"><b>' +
        absent +
        '</b><small>пропущено пар без УП</small></div><div class="stat"><b>' +
        attention.length +
        '</b><small>требуют внимания</small></div></div><section class="card"><h2>Кому нужно внимание</h2>' +
        (attention
          .map((s) => '<p>' + U.esc(s.name) + ' · ' + Curator.stats(s).pct + '%</p>')
          .join('') ||
          '<p class="hint">По отмеченным парам нет студентов с посещаемостью ниже 70%.</p>') +
        '</section><button class="btn primary" data-action="nav" data-tab="schedule">Моё преподавательское расписание →</button>'
      );
    }
    if (tab === 'news')
      return (
        html +
        (Curator.bundle.news
          .map(
            (n) =>
              '<article class="card"><h2>' +
              U.esc(n.title) +
              '</h2><small>' +
              U.esc(n.date || '') +
              '</small><p class="curator-text">' +
              U.esc(n.body || '') +
              '</p></article>',
          )
          .join('') || '<section class="card">В этой группе пока нет новостей.</section>')
      );
    if (tab === 'journal')
      return (
        html +
        '<label class="field">Дата<input class="input" type="date" data-curator="date" value="' +
        Curator.date +
        '"></label><div class="tbl-wrap"><table class="grid-tbl curator-table"><thead><tr><th>Студент</th>' +
        [1, 2, 3, 4, 5].map((p) => '<th>' + p + ' пара</th>').join('') +
        '</tr></thead><tbody>' +
        students
          .map(
            (s) =>
              '<tr><td>' +
              U.esc(s.name) +
              (s.registered ? '' : '<small>Не зарегистрирован(а)</small>') +
              '</td>' +
              [1, 2, 3, 4, 5]
                .map((p) => {
                  const st = s.registered ? Curator.status(s, Curator.date, p) : '';
                  return '<td><span class="tag">' + (st ? st.toUpperCase() : '—') + '</span></td>';
                })
                .join('') +
              '</tr>',
          )
          .join('') +
        '</tbody></table></div><p class="hint">«—» означает отсутствие отметки в этом слоте. УП учитывает подтверждённые справки.</p>'
      );
    return (
      html +
      '<div class="tbl-wrap"><table class="grid-tbl curator-table"><thead><tr><th>Студент</th><th>Статус</th><th>П</th><th>О</th><th>Н</th><th>УП</th><th>%</th></tr></thead><tbody>' +
      students
        .map((s) => {
          const st = Curator.stats(s);
          return (
            '<tr><td>' +
            U.esc(s.name) +
            '</td><td>' +
            (s.registered ? 'В приложении' : 'Не зарегистрирован(а)') +
            '</td><td>' +
            st.п +
            '</td><td>' +
            st.о +
            '</td><td>' +
            st.н +
            '</td><td>' +
            st.уп +
            '</td><td>' +
            (st.pct === null ? '—' : st.pct + '%') +
            '</td></tr>'
          );
        })
        .join('') +
      '</tbody></table></div><p class="hint">Процент считается по уже отмеченным парам за выбранный месяц.</p>'
    );
  },
  normalizeTeacher(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[\s.]/g, '')
      .replace(/ё/g, 'е');
  },
  validFeed(data) {
    const target = Curator.normalizeTeacher(Curator.context()?.teacher);
    return !!(
      data &&
      data.schema === 1 &&
      data.kind === 'teacher' &&
      Curator.normalizeTeacher(data.teacher) === target &&
      /^\d{4}-\d{2}-\d{2}$/.test(data.checked_at || '') &&
      data.days &&
      Object.keys(data.days).length &&
      Object.entries(data.days).every(
        ([date, day]) =>
          /^\d{4}-\d{2}-\d{2}$/.test(date) &&
          Array.isArray(day.lessons) &&
          day.lessons.every(
            (l) =>
              (Curator.normalizeTeacher(l.teacher) === target ||
                (['replacement', 'cancellation'].includes(l.status) &&
                  Curator.normalizeTeacher(l.original_teacher) === target)) &&
              Number.isInteger(l.lesson_number) &&
              Array.isArray(l.group_list),
          ),
      )
    );
  },
  async loadFeed() {
    if (Curator.feedLoading || !Curator.enabled()) return;
    Curator.feedLoading = true;
    if(Cloud.facultyContext?.active){await Faculty.load();const row=Faculty.data?.teachers.find(t=>t.name===Curator.context().name);if(row&&!row.schedule_file){Curator.feedError='Сайт колледжа пока не предоставил расписание этого преподавателя. Проверяем автоматически.';Curator.feedLoading=false;App.renderSoft();return;}}
    const owner = Cloud.uid,
      file = Curator.context().schedule_file;
    if (!/^schedule-teacher-[a-z0-9-]+\.json$/.test(file || '')) {
      Curator.feedLoading = false;
      return;
    }
    try {
      let data;
      for (const url of [
        'https://raw.githubusercontent.com/ariignatenok/politeshik/main/data/' + file,
        'data/' + file,
      ]) {
        try {
          const response = await fetch(url + '?t=' + Date.now(), {
            cache: 'no-store',
            signal: AbortSignal.timeout(12000),
          });
          if (!response.ok) throw Error('HTTP ' + response.status);
          const next = await response.json();
          if (!Curator.validFeed(next))
            throw Error('Источник вернул расписание другого преподавателя');
          data = next;
          break;
        } catch (error) {
          Curator.feedError = error.message;
        }
      }
      if (owner !== Cloud.uid) return;
      if (!data) throw Error(Curator.feedError || 'Нет данных расписания');
      Curator.feed = data;
      Curator.feedAt = Date.now();
      Curator.feedError = '';
    } catch (error) {
      if (owner === Cloud.uid) Curator.feedError = error.message;
    } finally {
      Curator.feedLoading = false;
      App.renderSoft();
    }
  },
  scheduleView() {
    if (!Curator.feed && !Curator.feedLoading && !Curator.feedError) Curator.loadFeed();
    const data = Curator.feed;
    let html =
      '<div class="page-head"><div><h1>Моё расписание</h1><p>' +
      U.esc(Curator.context().name) +
      ' · ' +
      U.esc(Curator.context().teacher) +
      '</p></div><button class="btn" data-action="curator-feed-refresh">Обновить</button></div><p class="hint">Преподавательские занятия во всех группах, где вы ведёте пары. Закреплённые группы доступны в журнале и разделе «Студенты».</p>';
    if (Curator.feedError)
      html +=
        '<p class="warn">' +
        U.esc(Curator.feedError) +
        (data ? ' · показана последняя загруженная копия' : '') +
        '</p>';
    if (!data) return html + '<section class="card">'+(Curator.feedError?'Расписание пока недоступно. Попробуйте обновить позже.':'Загружаем расписание преподавателя…')+'</section>';
    const ws = Curator.week,
      from = U.fromISO(ws),
      end = U.iso(U.addDays(from, 6)),
      days = Object.entries(data.days).filter(([date]) => date >= ws && date <= end);
    html +=
      '<div class="head-actions"><button class="btn" data-action="curator-week" data-d="-1">← Неделя</button><b>' +
      U.esc(ws) +
      ' — ' +
      end +
      '</b><button class="btn" data-action="curator-week" data-d="1">Неделя →</button></div><p class="hint">Данные от ' +
      data.checked_at +
      ' · Источник: polytech-schedule.ru. Проверка — каждые 15 минут.</p>';
    if (!days.length)
      return (
        html +
        '<section class="card">Для этой недели источник пока не предоставил данные.</section>'
      );
    return (
      html +
      days
        .map(
          ([date, day]) =>
            '<section class="card"><h2>' +
            U.esc(U.fmtLong(U.fromISO(date))) +
            '</h2>' +
            (day.lessons
              .map(
                (l) =>
                  '<div class="item"><div class="item-main"><b>' +
                  l.lesson_number +
                  ' пара · ' +
                  U.esc(l.subject) +
                  '</b><p>' +
                  l.group_list.map((g) => '<span class="tag">' + U.esc(g) + '</span>').join(' ') +
                  ' <span class="tag">' +
                  U.esc(l.classroom || l.auditorium || 'Аудитория не указана') +
                  '</span>' +
                  (l.status !== 'ok'
                    ? '<span class="tag">' +
                      (l.status === 'cancellation' ? 'Отмена' : 'Замена') +
                      '</span>'
                    : '') +
                  '</p>' +
                  (l.note ? '<small>' + U.esc(l.note) + '</small>' : '') +
                  '</div></div>',
              )
              .join('') || '<p class="hint">В полученных данных занятий нет.</p>') +
            '</section>',
        )
        .join('')
    );
  },
};
Object.assign(A, {
  'curator-group': (el) => Curator.select(el.dataset.tenant),
  'curator-refresh': () => Curator.load(),
  'curator-feed-refresh': () => Curator.loadFeed(),
  'curator-week': (el) => {
    Curator.week = U.iso(U.addDays(U.fromISO(Curator.week), Number(el.dataset.d) * 7));
    App.render();
  },
});
document.addEventListener('change', (event) => {
  if (!Curator.enabled()) return;
  const el = event.target,
    kind = el.dataset.curator;
  if (kind === 'group') Curator.select(el.value);
  else if (kind === 'month' && /^20\d{2}-(0[1-9]|1[0-2])$/.test(el.value)) {
    Curator.month = el.value;
    Curator.date = el.value + '-01';
    Curator.token++;
    Curator.loading = false;
    Curator.bundle = null;
    Curator.load();
    App.render();
  } else if (kind === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(el.value)) {
    Curator.date = el.value;
    if (Curator.month !== el.value.slice(0, 7)) {
      Curator.month = el.value.slice(0, 7);
      Curator.token++;
      Curator.loading = false;
      Curator.bundle = null;
      Curator.load();
    }
    App.render();
  }
});
