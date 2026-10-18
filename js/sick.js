'use strict';

const Sick = {
  /**
   * Находит пары расписания, выпавшие на дни справки.
   * @param {string} from Первый день справки, ГГГГ-ММ-ДД.
   * @param {string} to Последний день справки, ГГГГ-ММ-ДД.
   * @param {string} subgroup Подгруппа студента.
   * @returns {Object} дни, предметы, общее число пар.
   */
  missed(from, to, subgroup) {
    const days = [],
      bySubject = {},
      limit = 62,
      end = U.fromISO(to);
    let day = U.fromISO(from);
    for (let i = 0; day <= end && i < limit; i++, day = U.addDays(day, 1)) {
      const iso = U.iso(day);
      const items = Att.pairs(iso, subgroup).map(p => {
        const lesson = p.lessons[0],
          subject = subj(lesson.subjectId);
        return {
          pair: p.pair,
          subjectId: lesson.subjectId,
          name: subject ? subject.short || subject.name : 'Пара'
        };
      });
      if (!items.length) continue;
      days.push({
        date: iso,
        items
      });
      items.forEach(item => {
        const entry =
          bySubject[item.subjectId] ||
          (bySubject[item.subjectId] = {
            id: item.subjectId,
            name: item.name,
            color: (subj(item.subjectId) || {}).color || '',
            count: 0
          });
        entry.count++;
      });
    }
    return {
      days,
      subjects: Object.values(bySubject).sort((a, b) => b.count - a.count),
      total: days.reduce((sum, d) => sum + d.items.length, 0),
      cut: U.dayDiff(U.fromISO(from), end) + 1 > limit
    };
  },
  /**
   * Строит сообщение Политешика о пропущенных парах.
   * @param {Object} cert Справка: kind, from, to.
   * @param {Object} miss Результат Sick.missed.
   * @returns {string} HTML.
   */
  html(cert, miss) {
    const sick = cert.kind === 'Больничный';
    const lead = sick
      ? 'Сочувствую, что ты болеешь! ' + ICONS.cryingFace + ' Не переживай, вот что ты пропустил:'
      : 'Принял справку. Вот какие пары выпали на эти дни:';
    let body;
    if (!miss.total) {
      body =
        '<p class="sick-lead">' +
        (sick ? 'Сочувствую, что ты болеешь! ' + ICONS.cryingFace + ' ' : '') +
        'На эти дни пар нет, так что ничего не пропущено.</p>';
    } else {
      const lines = miss.days
        .map(
          d =>
            '<li><b>' +
            U.esc(U.fmtShort(U.fromISO(d.date))) +
            '</b>: ' +
            d.items.map(i => i.pair + ' пара — ' + U.esc(i.name)).join('; ') +
            '</li>'
        )
        .join('');
      const chips = miss.subjects
        .map(s => {
          const hasNotes = Store.s.notes.some(n => n.subjectId === s.id);
          return (
            '<span class="sick-subj"><span class="chip" style="--c:' +
            (s.color || '#64748b') +
            '">' +
            U.esc(s.name) +
            ' · ' +
            s.count +
            '</span>' +
            (hasNotes
              ? '<button class="btn ghost sm" data-action="sick-notes" data-id="' + s.id + '">Конспекты</button>'
              : '') +
            '</span>'
          );
        })
        .join('');
      body =
        '<p class="sick-lead">' +
        lead +
        '</p><ul class="sick-list">' +
        lines +
        '</ul><div class="sick-subjects">' +
        chips +
        '</div>' +
        (miss.cut ? '<p class="md-help">Показаны первые 62 дня.</p>' : '') +
        '<p class="sick-end">Выздоравливай!</p>';
    }
    return (
      '<div class="sick-card"><div class="sick-mascot">' +
      Mascot.svg('sad', 96) +
      '</div><div class="sick-bubble">' +
      body +
      '</div></div>' +
      '<div class="modal-foot"><button class="btn primary" data-action="modal-close">Спасибо, Политешик!</button></div>'
    );
  },
  /**
   * Показывает окно заботы Политешика после добавления справки.
   * @param {Object} cert Справка: kind, from, to.
   * @returns {Object} список пропущенного.
   */
  show(cert) {
    const miss = Sick.missed(cert.from, cert.to, Store.s.settings.subgroup);
    UI.open('Политешик', Sick.html(cert, miss), {
      noFocus: true
    });
    return miss;
  }
};
