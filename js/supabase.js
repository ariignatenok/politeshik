'use strict';

const SUPA_URL = 'https://mrxqzzaayyaiwyarwqsg.supabase.co';
const SUPA_KEY = 'sb_publishable_l6d7ITCOELD83veX6pV_fg_iee8Gizv';
const supa =
  window.supabase && window.supabase.createClient
    ? window.supabase.createClient(SUPA_URL, SUPA_KEY, {auth: {persistSession: true, autoRefreshToken: true}})
    : null;

/**
 * Переводит ошибку входа Supabase в понятное сообщение.
 * @param {Object} e Ошибка Supabase.
 * @returns {string} Строка.
 */
function friendlyAuthError(e) {
  const m = String((e && (e.message || e.msg)) || e),
    c = String((e && (e.code || e.error_code)) || '');
  if (/invalid login credentials|invalid_credentials/i.test(m + c)) return 'неверный email или пароль';
  if (/already registered|user_already_exists/i.test(m + c)) return 'такой email уже зарегистрирован — нажмите «Войти»';
  if (/password should be at least|weak_password/i.test(m + c)) return 'пароль слишком короткий (минимум 6 символов)';
  if (/invalid api key|apikey/i.test(m)) return 'неверный ключ Supabase в файле (SUPA_KEY)';
  if (/fetch|network|load failed|retryable/i.test(m + c))
    return 'нет связи с Supabase: проверьте интернет и адрес проекта в файле (SUPA_URL)';
  if (/rate limit/i.test(m)) return 'слишком много попыток, подождите минуту';
  return m;
}
