'use strict';

/**
 * Находит первый элемент по CSS-селектору.
 * @param {string} s CSS-селектор.
 * @param {ParentNode} [r] Корневой элемент поиска (необязательно).
 * @returns {HTMLElement|null} Результат.
 */
const $ = (s, r = document) => r.querySelector(s);
const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const DAYS_FULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
const WORK_TYPES = ['Контрольная', 'Работа', 'Зачёт', 'Экзамен', 'Лабораторная', 'Доклад', 'Дедлайн', 'Другое'];
const COLORS = [
  '#6366f1',
  '#22c55e',
  '#f59e0b',
  '#ec4899',
  '#06b6d4',
  '#a855f7',
  '#ef4444',
  '#14b8a6',
  '#eab308',
  '#3b82f6',
  '#f97316',
  '#84cc16'
];
const WEEK_NAME = {num: 'числитель', den: 'знаменатель', both: 'каждая неделя'};

const U = {
  /**
   * Создаёт короткий уникальный идентификатор с префиксом.
   * @param {string} [p] Префикс идентификатора (необязательно).
   * @returns {string} Строка.
   */
  uid: (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4),
  /**
   * Экранирует специальные символы HTML.
   * @param {string} s Исходный текст.
   * @returns {string} Строка.
   */
  esc: s =>
    String(s == null ? '' : s).replace(
      /[&<>"']/g,
      c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]
    ),
  /**
   * Дополняет число нулём слева до двух знаков.
   * @param {number} n Число.
   * @returns {string} Строка.
   */
  pad: n => String(n).padStart(2, '0'),

  /**
   * Переводит дату в формат ГГГГ-ММ-ДД.
   * @param {Date} d Дата.
   * @returns {string} Строка.
   */
  iso(d) {
    return d.getFullYear() + '-' + U.pad(d.getMonth() + 1) + '-' + U.pad(d.getDate());
  },
  /**
   * Разбирает строку ГГГГ-ММ-ДД в локальную дату.
   * @param {string} s Дата в формате ГГГГ-ММ-ДД.
   * @returns {Date} Дата.
   */
  fromISO(s) {
    const p = String(s).split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  },
  /**
   * Возвращает сегодняшнюю дату без времени.
   * @returns {Date} Дата.
   */
  today() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  },
  /**
   * Сдвигает дату на заданное число дней.
   * @param {Date} d Исходная дата.
   * @param {number} n Сколько дней прибавить.
   * @returns {Date} Дата.
   */
  addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  },
  /**
   * Находит понедельник недели даты.
   * @param {Date} d Дата.
   * @returns {Date} Дата.
   */
  mondayOf(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x;
  },
  /**
   * Считает разницу между датами в днях.
   * @param {Date} a Начальная дата.
   * @param {Date} b Конечная дата.
   * @returns {number} Число.
   */
  dayDiff(a, b) {
    return Math.round(
      (Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) /
        864e5
    );
  },
  /**
   * Возвращает номер дня недели, где понедельник равен 0.
   * @param {Date} d Дата.
   * @returns {number} Число.
   */
  dayIdx(d) {
    return (d.getDay() + 6) % 7;
  },
  /**
   * Форматирует дату коротко.
   * @param {Date} d Дата.
   * @returns {string} Строка.
   */
  fmtShort: d => new Intl.DateTimeFormat('ru-RU', {weekday: 'short', day: 'numeric', month: 'short'}).format(d),
  /**
   * Форматирует дату полностью.
   * @param {Date} d Дата.
   * @returns {string} Строка.
   */
  fmtLong: d => new Intl.DateTimeFormat('ru-RU', {weekday: 'long', day: 'numeric', month: 'long'}).format(d),
  /**
   * Подбирает форму слова по числу.
   * @param {number} n Число.
   * @param {string} a Форма для 1.
   * @param {string} b Форма для 2-4.
   * @param {string} c Форма для 5 и больше.
   * @returns {string} Строка.
   */
  plural(n, a, b, c) {
    n = Math.abs(n) % 100;
    const k = n % 10;
    if (n > 10 && n < 20) return c;
    if (k > 1 && k < 5) return b;
    if (k === 1) return a;
    return c;
  },
  /**
   * Строит инициалы из имени.
   * @param {string} n Имя и фамилия.
   * @returns {string} Строка.
   */
  initials: n =>
    String(n)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0])
      .join('')
      .toUpperCase() || '?',
  /**
   * Приводит строку к нижнему регистру без буквы ё для поиска.
   * @param {string} s Исходный текст.
   * @returns {string} Строка.
   */
  norm: s =>
    String(s || '')
      .toLowerCase()
      .replace(/ё/g, 'е'),
  /**
   * Перемешивает копию массива.
   * @param {Array} a Исходный массив.
   * @returns {Array} Массив.
   */
  shuffle(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }
};

/**
 * Определяет тип недели по дате: числитель или знаменатель.
 * @param {Date|string} date Дата.
 * @returns {string} Строка.
 */
function weekType(date) {
  const anchor = U.fromISO(Store.s.settings.numeratorAnchor);
  const w = Math.round(U.dayDiff(anchor, U.mondayOf(date)) / 7);
  return ((w % 2) + 2) % 2 === 0 ? 'num' : 'den';
}

/**
 * Строит момент срока сдачи; без времени срок заканчивается в конце дня.
 * @param {string} date Дата.
 * @param {string} time Время.
 * @returns {Date} Дата.
 */
function dueDate(date, time) {
  const d = U.fromISO(date);
  if (time) {
    const p = time.split(':').map(Number);
    d.setHours(p[0] || 0, p[1] || 0, 0, 0);
  } else d.setHours(23, 59, 0, 0);
  return d;
}
/**
 * Оценивает срочность срока.
 * @param {string} date Дата.
 * @param {string} time Время.
 * @returns {string} red, yellow, green или none.
 */
function urgency(date, time) {
  const h = (dueDate(date, time) - new Date()) / 36e5;
  return h < 24 ? 'red' : h < 72 ? 'yellow' : 'none';
}
/**
 * Проверяет, что срок сдачи уже прошёл.
 * @param {string} date Дата.
 * @param {string} time Время.
 * @returns {boolean} true, если условие выполнено.
 */
function isPastDue(date, time) {
  return !!date && dueDate(date, time) < new Date();
}
/**
 * Сокращает дату ГГГГ-ММ-ДД до вида ДД.ММ.
 * @param {string} iso Дата в формате ГГГГ-ММ-ДД.
 * @returns {string} Строка.
 */
function shortDate(iso) {
  return iso.slice(8, 10) + '.' + iso.slice(5, 7);
}
/**
 * Подписывает срок словами: сегодня, завтра, через N дней.
 * @param {string} date Дата в формате ГГГГ-ММ-ДД.
 * @returns {string} Строка.
 */
function relLabel(date) {
  const n = U.dayDiff(U.today(), U.fromISO(date));
  if (n < 0) return 'Просрочено · ' + -n + ' ' + U.plural(-n, 'день', 'дня', 'дней');
  if (n === 0) return 'Сегодня';
  if (n === 1) return 'Завтра';
  if (n === 2) return 'Послезавтра';
  return 'Через ' + n + ' ' + U.plural(n, 'день', 'дня', 'дней');
}

/**
 * Сохраняет файл на устройство пользователя.
 * @param {Blob} blob Содержимое файла.
 * @param {string} name Имя файла.
 */
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
/**
 * Переводит размер файла в читаемый вид (КБ или МБ).
 * @param {number} bytes Размер в байтах.
 * @returns {string} Строка.
 */
function sizeText(bytes) {
  return bytes >= 1048576
    ? (bytes / 1048576).toFixed(1).replace('.', ',') + ' МБ'
    : Math.max(1, Math.round((bytes || 0) / 1024)) + ' КБ';
}
