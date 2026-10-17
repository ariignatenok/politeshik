# Политешик — учебный планировщик группы 25290909/3091

Веб-приложение без сборки: обычные HTML, CSS и JavaScript плюс Supabase (вход, база данных).

## Структура проекта

```
index.html            разметка страницы и порядок подключения скриптов
assets/favicon.svg    значок вкладки
css/
  style.css           точка входа: подключает остальные файлы стилей
  base.css            переменные, сброс, безопасные зоны телефона
  layout.css          каркас: меню, шапка, сетка
  components.css      кнопки, поля, карточки, списки работ, статусы
  schedule.css  subjects.css  study.css  screens.css  admin.css
  modal.css           модальные окна и уведомления
  gate.css            экран входа
  themes.css          семь тем оформления и фоновые анимации
  mascot.css  profile.css  widgets.css  chats.css  news.css  attendance-edit.css  responsive.css
js/
  supabase.js         инициализация клиента Supabase
  db.js               работа с таблицей docs и облачным состоянием (объект Cloud)
  views.js            реестр экранов (какая вкладка какой функцией рисуется)
  app.js              запуск, маршрутизация, перерисовка, экран входа
  views/              отрисовка экранов: dashboard, schedule, subjects, attendance, chat, news, group, journal, homework, rating ...
  actions.js + actions/   обработчики кнопок (data-action), разбиты по областям
  forms.js            обработчики форм (data-form)
  dialogs.js          модальные окна и формы
  events.js           общие обработчики событий документа
  dm.js               личный чат студента с админом (таблица chat)
  news.js             новости и комментарии (таблицы news, news_comments)
  chat.js             чат с Политешиком (бот-житель)
  attendance.js  rating.js  achievements.js  notifications.js  changes.js  profile.js ...   логика
  store.js            локальное состояние (localStorage)
  utils.js  markdown.js  selectors.js  permissions.js  themes.js  ui.js ...   вспомогательные модули
  icons.js            все пиктограммы интерфейса (записаны кодами Unicode)
  data/               стартовые карточки, конспекты и формулы
sql/politeshik.sql    SQL для Supabase: правила доступа, секретный пароль админа, чат, новости
```

Скрипты подключаются обычными тегами `<script>` и делят общую область видимости, поэтому **порядок в index.html важен**: сначала данные и утилиты, затем логика, экраны, формы, обработчики, в конце app.js.

## Правила кода

- В коде нет комментариев, кроме JSDoc у функций.
- В коде нет эмодзи: пиктограммы лежат в `js/icons.js` и вызываются как `ICONS.название`.
- Данные студентов и права защищены на сервере (RLS в `sql/politeshik.sql`), а не в браузере.

## Установка на GitHub Pages

1. Распакуйте архив. В репозитории `ariignatenok/politeshik` должны лежать `index.html`, папки `css`, `js`, `assets` (старый одиночный `index.html` заменится новым).
2. Через GitHub Desktop: скопируйте содержимое папки в папку репозитория, нажмите Commit to main, затем Push origin.
   Через сайт: Add file, Upload files, перетащите `index.html` и три папки целиком, Commit changes.
3. Подождите 1-2 минуты и обновите сайт (Cmd+Shift+R).

## SQL в Supabase

1. Откройте `sql/politeshik.sql`. В самом верху замените `ПРИДУМАЙТЕ_СЕКРЕТНЫЙ_ПАРОЛЬ` на свой секретный пароль (минимум 8 символов). Если вставите прежний пароль, он останется прежним.
2. Supabase, SQL Editor, New query: вставьте весь файл и нажмите Run (на «Potential issue» нажмите Run query). Скрипт можно запускать повторно.

## Вход админа

Регистрация со своей почты, выбор «ИГНАТЕНОК Арина», ввод секретного пароля. Секретный пароль проверяет сервер.
