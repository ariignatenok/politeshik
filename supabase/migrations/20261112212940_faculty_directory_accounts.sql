-- Public names/timetables are separate from private, owner-approved Auth bindings.
create table politeshik_private.faculty_directory(
 id text primary key,name text not null unique,teacher_key text not null,schedule_file text not null);
create table politeshik_private.faculty_scopes(
 faculty_id text not null references politeshik_private.faculty_directory(id),
 tenant_id text not null references public.tenants(id),group_id text not null references public.groups(id),subjects jsonb not null,
 primary key(faculty_id,tenant_id));
create table politeshik_private.faculty_claims(
 uid uuid primary key references auth.users(id) on delete cascade,
 faculty_id text not null references politeshik_private.faculty_directory(id),
 status text not null default 'pending' check(status in('pending','approved','rejected','banned')),
 created_at timestamptz not null default now(),decided_at timestamptz,decided_by uuid references auth.users(id));
create unique index faculty_one_approved_identity on politeshik_private.faculty_claims(faculty_id) where status='approved';
alter table politeshik_private.faculty_directory enable row level security;
alter table politeshik_private.faculty_scopes enable row level security;
alter table politeshik_private.faculty_claims enable row level security;
revoke all on politeshik_private.faculty_directory,politeshik_private.faculty_scopes,politeshik_private.faculty_claims from public,anon,authenticated;
create policy faculty_directory_internal on politeshik_private.faculty_directory as restrictive for all to authenticated using(false) with check(false);
create policy faculty_scopes_internal on politeshik_private.faculty_scopes as restrictive for all to authenticated using(false) with check(false);
create policy faculty_claims_internal on politeshik_private.faculty_claims as restrictive for all to authenticated using(false) with check(false);
insert into politeshik_private.faculty_directory(id,name,teacher_key,schedule_file) values
('faculty-fef89b8bfbf9','Аболецкая Лидия Владимировна','Аболецкая Л.В.','schedule-teacher-faculty-fef89b8bfbf9.json'),
('faculty-3ce882e215c8','Андреев Владимир Александрович','Андреев В.А.','schedule-teacher-faculty-3ce882e215c8.json'),
('faculty-ae1169086001','Андреев Дмитрий Викторович','Андреев Д.В.','schedule-teacher-faculty-ae1169086001.json'),
('faculty-68d9711e8c64','Антонов Андрей Александрович','Антонов А.А.','schedule-teacher-faculty-68d9711e8c64.json'),
('faculty-7cbb895cc502','Ахмадиева Светлана Ахатовна','Ахмадиева С.А.','schedule-teacher-faculty-7cbb895cc502.json'),
('faculty-6b744383922e','Багнюк Виталий Евгеньевич','Багнюк В.Е.','schedule-teacher-faculty-6b744383922e.json'),
('faculty-9df33402caee','Баженова Татьяна Сергеевна','Баженова Т.С.','schedule-teacher-faculty-9df33402caee.json'),
('faculty-8691ed508560','Балдина Любовь Сергеевна','Балдина Л.С.','schedule-teacher-faculty-8691ed508560.json'),
('faculty-00393e9e4364','Берковиц Александр Владимирович','Берковиц А.В.','schedule-teacher-faculty-00393e9e4364.json'),
('faculty-29f8b3697f67','Бирюкова Татьяна Николаевна','Бирюкова Т.Н.','schedule-teacher-faculty-29f8b3697f67.json'),
('faculty-e3efadbcac1c','Большакова Анна Владимировна','Большакова А.В.','schedule-teacher-faculty-e3efadbcac1c.json'),
('faculty-c20afdfad898','Бондарева Анжелика Владимировна','Бондарева А.В.','schedule-teacher-faculty-c20afdfad898.json'),
('faculty-a143e7c90cb7','Бурлакова Елена Николаевна','Бурлакова Е.Н.','schedule-teacher-faculty-a143e7c90cb7.json'),
('faculty-021571213883','Бурмистрова Марина Васильевна','Бурмистрова М.В.','schedule-teacher-faculty-021571213883.json'),
('faculty-487dfcd45374','Бурмистрова Руслана Дмитриевна','Бурмистрова Р.Д.','schedule-teacher-faculty-487dfcd45374.json'),
('faculty-30fa65e9fcbe','Буров Владимир Александрович','Буров В.А.','schedule-teacher-faculty-30fa65e9fcbe.json'),
('faculty-c6d5f036828d','Бурова Татьяна Евгеньевна','Бурова Т.Е.','schedule-teacher-faculty-c6d5f036828d.json'),
('faculty-8d391595fd15','Вакулин Андрей Игоревич','Вакулин А.И.','schedule-teacher-faculty-8d391595fd15.json'),
('faculty-97261ab09c98','Варфоломеева Наталья Михайловна','Варфоломеева Н.М.','schedule-teacher-faculty-97261ab09c98.json'),
('faculty-d1d8538f5b95','Васильев Андрей Васильевич','Васильев А.В.','schedule-teacher-faculty-d1d8538f5b95.json'),
('faculty-2f2c346102e6','Васильев Сергей Юрьевич','Васильев С.Ю.','schedule-teacher-faculty-2f2c346102e6.json'),
('faculty-030af74c3be2','Вдовина Вера Николаевна','Вдовина В.Н.','schedule-teacher-faculty-030af74c3be2.json'),
('faculty-076784b32ea9','Веснин Евгений Юрьевич','Веснин Е.Ю.','schedule-teacher-faculty-076784b32ea9.json'),
('faculty-5cb4ea658c43','Вимберг Светлана Витальевна','Вимберг С.В.','schedule-teacher-faculty-5cb4ea658c43.json'),
('faculty-8bdc6f2727f7','Волков Дмитрий Иванович','Волков Д.И.','schedule-teacher-faculty-8bdc6f2727f7.json'),
('faculty-c61c148bdaa3','Волчков Иван Витальевич','Волчков И.В.','schedule-teacher-faculty-c61c148bdaa3.json'),
('faculty-c26d9b9d2683','Воробьев Константин Владимирович','Воробьев К.В.','schedule-teacher-faculty-c26d9b9d2683.json'),
('faculty-44686e30cbe5','Втюрин Роман Леонидович','Втюрин Р.Л.','schedule-teacher-faculty-44686e30cbe5.json'),
('faculty-e29744376a40','Галушкина Ирина Васильевна','Галушкина И.В.','schedule-teacher-faculty-e29744376a40.json'),
('faculty-9fb71d94aee3','Гарифуллина Ирина Алексеевна','Гарифуллина И.А.','schedule-teacher-faculty-9fb71d94aee3.json'),
('faculty-bcae0f6f4765','Герасимова Мария Павловна','Герасимова М.П.','schedule-teacher-faculty-bcae0f6f4765.json'),
('faculty-7d49b1437da0','Герчикова Ирина Григорьевна','Герчикова И.Г.','schedule-teacher-faculty-7d49b1437da0.json'),
('faculty-f3cb5a3f2e21','Глушко Елена Ивановна','Глушко Е.И.','schedule-teacher-faculty-f3cb5a3f2e21.json'),
('faculty-837978ce530d','Голованков Денис Владимирович','Голованков Д.В.','schedule-teacher-faculty-837978ce530d.json'),
('faculty-9e3e94fdb0bb','Голощапова Ольга Викторовна','Голощапова О.В.','schedule-teacher-faculty-9e3e94fdb0bb.json'),
('faculty-7c6b89253572','Голубев Дэнис Михайлович','Голубев Д.М.','schedule-teacher-faculty-7c6b89253572.json'),
('faculty-f71f18623a9a','Голубенко Елена Борисовна','Голубенко Е.Б.','schedule-teacher-faculty-f71f18623a9a.json'),
('faculty-976c389d62b3','Голубенко Наталья Олеговна','Голубенко Н.О.','schedule-teacher-faculty-976c389d62b3.json'),
('faculty-6e270f05fe31','Горбанёва Юлия Сергеевна','Горбанёва Ю.С.','schedule-teacher-faculty-6e270f05fe31.json'),
('faculty-4fd77fbde780','Грауэр Лидия Вальтеровна','Грауэр Л.В.','schedule-teacher-faculty-4fd77fbde780.json'),
('faculty-5fe93d0edf6b','Григорьева Надежда Геннадьевна','Григорьева Н.Г.','schedule-teacher-faculty-5fe93d0edf6b.json'),
('faculty-5b67a14e45c6','Гроза Мария Михайловна','Гроза М.М.','schedule-teacher-faculty-5b67a14e45c6.json'),
('faculty-1ff9e36f4d31','Груничев Вячеслав Владимирович','Груничев В.В.','schedule-teacher-faculty-1ff9e36f4d31.json'),
('faculty-31792c9f05c0','Гусарова Марина Николаевна','Гусарова М.Н.','schedule-teacher-faculty-31792c9f05c0.json'),
('faculty-dd8abb4184e4','Давыдов Сергей Николаевич','Давыдов С.Н.','schedule-teacher-faculty-dd8abb4184e4.json'),
('faculty-0a3d15424267','Данилова Ольга Сергеевна','Данилова О.С.','schedule-teacher-faculty-0a3d15424267.json'),
('faculty-cc1d7a6b9738','Дебич Максим Владимирович','Дебич М.В.','schedule-teacher-faculty-cc1d7a6b9738.json'),
('faculty-a3887dca85e9','Девятко Наталья Сергеевна','Девятко Н.С.','schedule-teacher-faculty-a3887dca85e9.json'),
('faculty-ac37100601c1','Дегтерева Светлана Викторовна','Дегтерева С.В.','schedule-teacher-faculty-ac37100601c1.json'),
('faculty-e95ae729133f','Дементьев Виталий Сергеевич','Дементьев В.С.','schedule-teacher-faculty-e95ae729133f.json'),
('faculty-697d78220946','Денисов Георгий Евгеньевич','Денисов Г.Е.','schedule-teacher-faculty-697d78220946.json'),
('faculty-04a1aadf5375','Дубейко Полина Сергеевна','Дубейко П.С.','schedule-teacher-faculty-04a1aadf5375.json'),
('faculty-892409579740','Евстигнеев Андрей Борисович','Евстигнеев А.Б.','schedule-teacher-faculty-892409579740.json'),
('faculty-0059b4806d40','Егорова Ксения Александровна','Егорова К.А.','schedule-teacher-faculty-0059b4806d40.json'),
('faculty-9d82521c1ce8','Ежов Евгений Игоревич','Ежов Е.И.','schedule-teacher-faculty-9d82521c1ce8.json'),
('faculty-3694ec38c045','Ефимова-Сойни Елена Абрамовна','Ефимова-Сойни Е.А.','schedule-teacher-faculty-3694ec38c045.json'),
('faculty-505e6c6a1bcf','Жеребчевская Екатерина Евгеньевна','Жеребчевская Е.Е.','schedule-teacher-faculty-505e6c6a1bcf.json'),
('faculty-5c51f385d1e0','Жукова Александра Михайловна','Жукова А.М.','schedule-teacher-faculty-5c51f385d1e0.json'),
('faculty-da4b3753143f','Журавлева Ольга Алексеевна','Журавлева О.А.','schedule-teacher-faculty-da4b3753143f.json'),
('faculty-8a73e464686d','Зацепина Наталья Денисовна','Зацепина Н.Д.','schedule-teacher-faculty-8a73e464686d.json'),
('faculty-db07bc37eb0d','Зернова Елена Николаевна','Зернова Е.Н.','schedule-teacher-faculty-db07bc37eb0d.json'),
('faculty-8bff3af2c46c','Зубарев Алексей Алексеевич','Зубарев А.А.','schedule-teacher-faculty-8bff3af2c46c.json'),
('faculty-c0415f4c6d7f','Зыблев Василий Александрович','Зыблев В.А.','schedule-teacher-faculty-c0415f4c6d7f.json'),
('faculty-cc24a3d5ec0e','Иванова Дарья Васильевна','Иванова Д.В.','schedule-teacher-faculty-cc24a3d5ec0e.json'),
('faculty-95fe46e97169','Ивашкова Надежда Александровна','Ивашкова Н.А.','schedule-teacher-faculty-95fe46e97169.json'),
('faculty-564e44d489d2','Игнатьев Евгений Александрович','Игнатьев Е.А.','schedule-teacher-faculty-564e44d489d2.json'),
('faculty-d5393280cf21','Ильин Юрий Петрович','Ильин Ю.П.','schedule-teacher-faculty-d5393280cf21.json'),
('faculty-1d2021b0b92c','Казаков Дмитрий Николаевич','Казаков Д.Н.','schedule-teacher-faculty-1d2021b0b92c.json'),
('faculty-d50e575fd99c','Киреенко Ксения Николаевна','Киреенко К.Н.','schedule-teacher-faculty-d50e575fd99c.json'),
('faculty-0e14e15cf3d5','Киселева Дарья Александровна','Киселева Д.А.','schedule-teacher-faculty-0e14e15cf3d5.json'),
('faculty-376b688a1992','Кобахидзе Натела Паатаевна','Кобахидзе Н.П.','schedule-teacher-faculty-376b688a1992.json'),
('faculty-9ca49d11c704','Коверина Нина Михайловна','Коверина Н.М.','schedule-teacher-faculty-9ca49d11c704.json'),
('faculty-3157d1358a43','Коннова Арина Евгеньевна','Коннова А.Е.','schedule-teacher-faculty-3157d1358a43.json'),
('faculty-3380bd4d5460','Корнеева Татьяна Алексеевна','Корнеева Т.А.','schedule-teacher-faculty-3380bd4d5460.json'),
('faculty-70eb4398be9b','Коровкина Наталья Михайловна','Коровкина Н.М.','schedule-teacher-faculty-70eb4398be9b.json'),
('faculty-18154fecd383','Коротышева Людмила Брониславовна','Коротышева Л.Б.','schedule-teacher-faculty-18154fecd383.json'),
('faculty-a3a54eb58c98','Костин Юрий Николаевич','Костин Ю.Н.','schedule-teacher-faculty-a3a54eb58c98.json'),
('faculty-cb2277eba71a','Краснобрыжева Юлия Сергеевна','Краснобрыжева Ю.С.','schedule-teacher-faculty-cb2277eba71a.json'),
('faculty-90d926210371','Краснопёрова Алина Денисовна','Краснопёрова А.Д.','schedule-teacher-faculty-90d926210371.json'),
('faculty-d74850bf5f88','Кротова Лариса Алексеевна','Кротова Л.А.','schedule-teacher-faculty-d74850bf5f88.json'),
('faculty-9902ce72edbd','Круглов Алексей Александрович','Круглов А.А.','schedule-teacher-faculty-9902ce72edbd.json'),
('faculty-5da8672d9e47','Кудайбергенова Марина Ивановна','Кудайбергенова М.И.','schedule-teacher-faculty-5da8672d9e47.json'),
('faculty-61a2d84bbbee','Кудрявцева Елена Владимировна','Кудрявцева Е.В.','schedule-teacher-faculty-61a2d84bbbee.json'),
('faculty-7be8ccfae298','Кузнецова Лиана Ивановна','Кузнецова Л.И.','schedule-teacher-faculty-7be8ccfae298.json'),
('faculty-b213b638dba2','Кузьмичев Виталий Валерьевич','Кузьмичев В.В.','schedule-teacher-faculty-b213b638dba2.json'),
('faculty-378d62525c55','Кулакова Диана Маратовна','Кулакова Д.М.','schedule-teacher-faculty-378d62525c55.json'),
('faculty-9da93e44ddb6','Куликов Иван Андреевич','Куликов И.А.','schedule-teacher-faculty-9da93e44ddb6.json'),
('faculty-5193b5223adc','Курылева Анастасия Александровна','Курылева А.А.','schedule-teacher-faculty-5193b5223adc.json'),
('faculty-bf310b6cf943','Кухаренкова Надежда Алексеевна','Кухаренкова Н.А.','schedule-teacher-faculty-bf310b6cf943.json'),
('faculty-3be55939e31f','Кучеренко Наталья Леонидовна','Кучеренко Н.Л.','schedule-teacher-faculty-3be55939e31f.json'),
('faculty-233395355ab5','Кялина Екатерина Михайловна','Кялина Е.М.','schedule-teacher-faculty-233395355ab5.json'),
('faculty-349017df5203','Лаврентьева Ольга Геворговна','Лаврентьева О.Г.','schedule-teacher-faculty-349017df5203.json'),
('faculty-bc821b0a3ad8','Латровкин Алексей Александрович','Латровкин А.А.','schedule-teacher-faculty-bc821b0a3ad8.json'),
('faculty-d925af77e6b5','Леленкова Елена Николаевна','Леленкова Е.Н.','schedule-teacher-faculty-d925af77e6b5.json'),
('faculty-6e109835c5b3','Линева Евгения Викторовна','Линева Е.В.','schedule-teacher-faculty-6e109835c5b3.json'),
('faculty-f6378254c6d1','Лужковский Андрей Викторович','Лужковский А.В.','schedule-teacher-faculty-f6378254c6d1.json'),
('faculty-e9b8a69943a2','Лысикова Александра Владимировна','Лысикова А.В.','schedule-teacher-faculty-e9b8a69943a2.json'),
('faculty-a74a84123f7c','Любицкая Екатерина Кирилловна','Любицкая Е.К.','schedule-teacher-faculty-a74a84123f7c.json'),
('faculty-1bf3af964d65','Лявданская Елена Викторовна','Лявданская Е.В.','schedule-teacher-faculty-1bf3af964d65.json'),
('faculty-87486acd5b71','Мадаев Рашид Арсланбегович','Мадаев Р.А.','schedule-teacher-faculty-87486acd5b71.json'),
('faculty-f650b2f43d0c','Малькова Елена Тимофеевна','Малькова Е.Т.','schedule-teacher-faculty-f650b2f43d0c.json'),
('faculty-2a15890c06c3','Маньшина Александра Вадимовна','Маньшина А.В.','schedule-teacher-faculty-2a15890c06c3.json'),
('faculty-f27546a1721b','Маркова Ольга Николаевна','Маркова О.Н.','schedule-teacher-faculty-f27546a1721b.json'),
('faculty-d913a63af0ce','Масимова Евгения Гаврииловна','Масимова Е.Г.','schedule-teacher-faculty-d913a63af0ce.json'),
('faculty-1f461d71227f','Маслакова Светлана Владимировна','Маслакова С.В.','schedule-teacher-faculty-1f461d71227f.json'),
('faculty-e6a9156d6f1b','Матвеева Ольга Ивановна','Матвеева О.И.','schedule-teacher-faculty-e6a9156d6f1b.json'),
('faculty-27a562309702','Матвеева Светлана Павловна','Матвеева С.П.','schedule-teacher-faculty-27a562309702.json'),
('faculty-29469a3b9ba9','Матвеева Юлия Аникториевна','Матвеева Ю.А.','schedule-teacher-faculty-29469a3b9ba9.json'),
('faculty-f85890a8a60c','Медведева Евгения Евгеньевна','Медведева Е.Е.','schedule-teacher-faculty-f85890a8a60c.json'),
('faculty-77a21bd98518','Медведева Ольга Владимировна','Медведева О.В.','schedule-teacher-faculty-77a21bd98518.json'),
('faculty-8882c5308fbe','Меньшиков Игорь Георгиевич','Меньшиков И.Г.','schedule-teacher-faculty-8882c5308fbe.json'),
('faculty-2b0f4c4004a8','Михайловская Виктория Валерьевна','Михайловская В.В.','schedule-teacher-faculty-2b0f4c4004a8.json'),
('faculty-3ba58257825a','Молькова Лолита Юрьевна','Молькова Л.Ю.','schedule-teacher-faculty-3ba58257825a.json'),
('faculty-e873dedba45e','Моторина Елена Львовна','Моторина Е.Л.','schedule-teacher-faculty-e873dedba45e.json'),
('faculty-049acfaa4f21','Мукбиль Мансур Хассан Мухаммад','Мукбиль Мансур Хассан Мухаммад','schedule-teacher-faculty-049acfaa4f21.json'),
('faculty-3c7319fda0f2','Муравьева Юлия Александровна','Муравьева Ю.А.','schedule-teacher-faculty-3c7319fda0f2.json'),
('faculty-f72122972383','Назаров Денис Александрович','Назаров Д.А.','schedule-teacher-faculty-f72122972383.json'),
('faculty-f01395cdd5e0','Назаров Сергей Юрьевич','Назаров С.Ю.','schedule-teacher-faculty-f01395cdd5e0.json'),
('faculty-4c9a96cf95ce','Нестеренок Вадим Владимирович','Нестеренок В.В.','schedule-teacher-faculty-4c9a96cf95ce.json'),
('faculty-93810ba1770f','Никитина Екатерина Сергеевна','Никитина Е.С.','schedule-teacher-faculty-93810ba1770f.json'),
('faculty-10e21641a19c','Никольский Валентин Валентинович','Никольский В.В.','schedule-teacher-faculty-10e21641a19c.json'),
('faculty-bde84e497bec','Нургалиева Елена Александровна','Нургалиева Е.А.','schedule-teacher-faculty-bde84e497bec.json'),
('faculty-c4090c1b5041','Окунева Жанна Анатольевна','Окунева Ж.А.','schedule-teacher-faculty-c4090c1b5041.json'),
('faculty-d4bc1b1889da','Ольнев Александр Александрович','Ольнев А.А.','schedule-teacher-faculty-d4bc1b1889da.json'),
('faculty-5fcdf5c0dc2e','Осипова Алена Сергеевна','Осипова А.С.','schedule-teacher-faculty-5fcdf5c0dc2e.json'),
('faculty-0a744e3c555e','Павлова Елена Геннадьевна','Павлова Е.Г.','schedule-teacher-faculty-0a744e3c555e.json'),
('faculty-ae2fa48b91f9','Панченко Михаил Станиславович','Панченко М.С.','schedule-teacher-faculty-ae2fa48b91f9.json'),
('faculty-7fcb23eb3eee','Панченко Яна Александровна','Панченко Я.А.','schedule-teacher-faculty-7fcb23eb3eee.json'),
('faculty-7aa81fc8312f','Петрова Светлана Николаевна','Петрова С.Н.','schedule-teacher-faculty-7aa81fc8312f.json'),
('faculty-46c9c9858378','Печковский Александр Владимирович','Печковский А.В.','schedule-teacher-faculty-46c9c9858378.json'),
('faculty-3889dbe5a6dd','Пиштокова Татьяна Романовна','Пиштокова Т.Р.','schedule-teacher-faculty-3889dbe5a6dd.json'),
('faculty-1be7d40e580c','Поединок Олеся Викторовна','Поединок О.В.','schedule-teacher-faculty-1be7d40e580c.json'),
('faculty-8f64619aab36','Прокофьев Антон Андреевич','Прокофьев А.А.','schedule-teacher-faculty-8f64619aab36.json'),
('faculty-206a646b3548','Пшеницына Мария Александровна','Пшеницына М.А.','schedule-teacher-faculty-206a646b3548.json'),
('faculty-c58749eac54b','Рамазанов Магомед Фазилович','Рамазанов М.Ф.','schedule-teacher-faculty-c58749eac54b.json'),
('faculty-1a390c43b0a7','Ревина Оксана Сергеевна','Ревина О.С.','schedule-teacher-faculty-1a390c43b0a7.json'),
('faculty-f9a5db0ce0b5','Родинов Иван Иванович','Родинов И.И.','schedule-teacher-faculty-f9a5db0ce0b5.json'),
('faculty-8d7ca2243af7','Родионова Ирина Вячеславовна','Родионова И.В.','schedule-teacher-faculty-8d7ca2243af7.json'),
('faculty-b0ae9510ad70','Рыжков Евгений Александрович','Рыжков Е.А.','schedule-teacher-faculty-b0ae9510ad70.json'),
('faculty-c79e3765fe15','Рындина Карина Олеговна','Рындина К.О.','schedule-teacher-faculty-c79e3765fe15.json'),
('faculty-c439f84349b4','Рябова Валерия Викторовна','Рябова В.В.','schedule-teacher-faculty-c439f84349b4.json'),
('faculty-c900e3daf4ad','Рябова Марина Николаевна','Рябова М.Н.','schedule-teacher-faculty-c900e3daf4ad.json'),
('faculty-662da4921f07','Савостина Татьяна Викторовна','Савостина Т.В.','schedule-teacher-faculty-662da4921f07.json'),
('faculty-68f0ca0ffbfd','Саитова Виктория Сергеевна','Саитова В.С.','schedule-teacher-faculty-68f0ca0ffbfd.json'),
('faculty-a9beb40dc7fd','Сараева Светлана Вячеславовна','Сараева С.В.','schedule-teacher-faculty-a9beb40dc7fd.json'),
('faculty-353f5e54045e','Селифонтова Анна Сергеевна','Селифонтова А.С.','schedule-teacher-faculty-353f5e54045e.json'),
('faculty-5378de79d42c','Симоненко Святослав Иванович','Симоненко С.И.','schedule-teacher-faculty-5378de79d42c.json'),
('faculty-2b3058ed4821','Слепов Владимир Михайлович','Слепов В.М.','schedule-teacher-faculty-2b3058ed4821.json'),
('faculty-a495f649adf4','Смекалова Юлия Викторовна','Смекалова Ю.В.','schedule-teacher-faculty-a495f649adf4.json'),
('faculty-f6ea627f1c4a','Смирнов Александр Валентинович','Смирнов А.В.','schedule-teacher-faculty-f6ea627f1c4a.json'),
('faculty-be432be381f9','Смирнов Александр Николаевич','Смирнов А.Н.','schedule-teacher-faculty-be432be381f9.json'),
('faculty-cebe0fe805df','Смирнов Сергей Геннадьевич','Смирнов С.Г.','schedule-teacher-faculty-cebe0fe805df.json'),
('faculty-61b6d224a0a2','Смирнова Виктория Владимировна','Смирнова В.В.','schedule-teacher-faculty-61b6d224a0a2.json'),
('faculty-2e145418011e','Смирнова Наталья Ивановна','Смирнова Н.И.','schedule-teacher-faculty-2e145418011e.json'),
('faculty-10469696c214','Смолина Ирина Михайловна','Смолина И.М.','schedule-teacher-faculty-10469696c214.json'),
('faculty-3e3e72a1b0a2','Субботин Андрей Александрович','Субботин А.А.','schedule-teacher-faculty-3e3e72a1b0a2.json'),
('faculty-c03ea348a29e','Сысоева Анастасия Дмитриевна','Сысоева А.Д.','schedule-teacher-faculty-c03ea348a29e.json'),
('faculty-ec314451fd1e','Талалаева Дарья Александровна','Талалаева Д.А.','schedule-teacher-faculty-ec314451fd1e.json'),
('faculty-b64fa733add1','Темченко Константин Александрович','Темченко К.А.','schedule-teacher-faculty-b64fa733add1.json'),
('faculty-3235afbd6230','Тимофеева Марина Александровна','Тимофеева М.А.','schedule-teacher-faculty-3235afbd6230.json'),
('faculty-982829b192b3','Тлеумбетов Тимур Денисович','Тлеумбетов Т.Д.','schedule-teacher-faculty-982829b192b3.json'),
('faculty-01999c98f27b','Трацевская Мария Владимировна','Трацевская М.В.','schedule-teacher-faculty-01999c98f27b.json'),
('faculty-fa360b11545a','Трегубова Людмила Анатольевна','Трегубова Л.А.','schedule-teacher-faculty-fa360b11545a.json'),
('faculty-189b53945859','Троцюк Светлана Николаевна','Троцюк С.Н.','schedule-teacher-faculty-189b53945859.json'),
('faculty-433728c880fc','Тузова Диана Анатольевна','Тузова Д.А.','schedule-teacher-faculty-433728c880fc.json'),
('faculty-7f0089cd8cbb','Федотова Галина Николаевна','Федотова Г.Н.','schedule-teacher-faculty-7f0089cd8cbb.json'),
('faculty-c63a2b32787e','Фурсова Анастасия Викторовна','Фурсова А.В.','schedule-teacher-faculty-c63a2b32787e.json'),
('faculty-7a1e08221a25','Цветкова Татьяна Юрьевна','Цветкова Т.Ю.','schedule-teacher-faculty-7a1e08221a25.json'),
('faculty-c5bb74ed5fbc','Чебачева Евгения Владимировна','Чебачева Е.В.','schedule-teacher-faculty-c5bb74ed5fbc.json'),
('faculty-00610de08487','Чекан Сергей Иванович','Чекан С.И.','schedule-teacher-faculty-00610de08487.json'),
('faculty-8b0d83aa0c37','Челищева Лилия Наталиевна','Челищева Л.Н.','schedule-teacher-faculty-8b0d83aa0c37.json'),
('faculty-9e033e676817','Черемонцева Ирина Васильевна','Черемонцева И.В.','schedule-teacher-faculty-9e033e676817.json'),
('faculty-56f8c3a61d19','Чигирь Полина Павловна','Чигирь П.П.','schedule-teacher-faculty-56f8c3a61d19.json'),
('faculty-ac23e036bc3e','Чужакова Полина Олеговна','Чужакова П.О.','schedule-teacher-faculty-ac23e036bc3e.json'),
('faculty-f2d756ef6280','Шаблаев Михаил Викторович','Шаблаев М.В.','schedule-teacher-faculty-f2d756ef6280.json'),
('faculty-0c1388d2ff9a','Шавров Александр Сергеевич','Шавров А.С.','schedule-teacher-faculty-0c1388d2ff9a.json'),
('faculty-ee0b3ca367e5','Шаврова Любовь Сергеевна','Шаврова Л.С.','schedule-teacher-faculty-ee0b3ca367e5.json'),
('faculty-ccbf05d535b4','Шацкая Татьяна Евгеньевна','Шацкая Т.Е.','schedule-teacher-faculty-ccbf05d535b4.json'),
('faculty-f62b38246923','Шетлер Игорь Юрьевич','Шетлер И.Ю.','schedule-teacher-faculty-f62b38246923.json'),
('faculty-7f6cd957201e','Шилова Алла Андреевна','Шилова А.А.','schedule-teacher-faculty-7f6cd957201e.json'),
('faculty-80dd129dc6bc','Шиляев Иван Константинович','Шиляев И.К.','schedule-teacher-faculty-80dd129dc6bc.json'),
('faculty-33b6d5431b91','Шиманская Каролина Владимировна','Шиманская К.В.','schedule-teacher-faculty-33b6d5431b91.json'),
('faculty-56a8256fdb9d','Щербак Алена Валериевна','Щербак А.В.','schedule-teacher-faculty-56a8256fdb9d.json'),
('faculty-14764eb0d37b','Юзова Юлия Александровна','Юзова Ю.А.','schedule-teacher-faculty-14764eb0d37b.json'),
('faculty-0db1cfc2eb2a','Юркевич Наталья Викторовна','Юркевич Н.В.','schedule-teacher-faculty-0db1cfc2eb2a.json'),
('faculty-65a1d3c4ffc7','Яценко Анна Ивановна','Яценко А.И.','schedule-teacher-faculty-65a1d3c4ffc7.json'),
('faculty-047d043706bd','Яшкова Надежда Владимировна','Яшкова Н.В.','schedule-teacher-faculty-047d043706bd.json');
insert into politeshik_private.faculty_scopes(faculty_id,tenant_id,group_id,subjects) values
('faculty-3ce882e215c8','group_1','g_main','["ОПБД"]'),
('faculty-3ce882e215c8','group_2','g_26290911_3111','["ОПБД"]'),
('faculty-ae1169086001','group_6','g_25290907_1091','["ОСиС"]'),
('faculty-021571213883','group_6','g_25290907_1091','["ЭВМ"]'),
('faculty-487dfcd45374','group_3','g_23290907_2092','["Ин. яз. в ПД"]'),
('faculty-2f2c346102e6','group_1','g_main','["МДК.01.01 Технология разработки информационных ресурсов", "МДК.01.02 Проектир. и разраб. интерф. пользов."]'),
('faculty-2f2c346102e6','group_2','g_26290911_3111','["Основы информационной безопасности"]'),
('faculty-5cb4ea658c43','group_3','g_23290907_2092','["Менеджм. в проф. деят."]'),
('faculty-44686e30cbe5','group_2','g_26290911_3111','["ОСиС"]'),
('faculty-31792c9f05c0','group_4','g_24290907_2092','["Ин. яз. в ПД"]'),
('faculty-31792c9f05c0','group_1','g_main','["Ин. яз. в ПД"]'),
('faculty-31792c9f05c0','group_2','g_26290911_3111','["Ин. яз. в ПД"]'),
('faculty-0a3d15424267','group_1','g_main','["ИТ в ПД лр", "ОАП_лр"]'),
('faculty-0a3d15424267','group_2','g_26290911_3111','["ИТ в ПД лр"]'),
('faculty-a3887dca85e9','group_2','g_26290911_3111','["ОАП"]'),
('faculty-9d82521c1ce8','group_4','g_24290907_2092','["ТВиМС"]'),
('faculty-da4b3753143f','group_3','g_23290907_2092','["МДК.01.04 Системное программирование"]'),
('faculty-da4b3753143f','group_6','g_25290907_1091','["ОАП"]'),
('faculty-db07bc37eb0d','group_3','g_23290907_2092','["МДК.02.03 Мат. моделирование"]'),
('faculty-8bff3af2c46c','group_1','g_main','["История России"]'),
('faculty-564e44d489d2','group_6','g_25290907_1091','["Архитектура аппаратных средств"]'),
('faculty-564e44d489d2','group_2','g_26290911_3111','["Архитектура аппаратных средств"]'),
('faculty-0e14e15cf3d5','group_2','g_26290911_3111','["История России"]'),
('faculty-a3a54eb58c98','group_4','g_24290907_2092','["Компьютерные сети"]'),
('faculty-90d926210371','group_6','g_25290907_1091','["ИТ лр"]'),
('faculty-90d926210371','group_1','g_main','["ИТ в ПД лр"]'),
('faculty-90d926210371','group_2','g_26290911_3111','["Управление ИТ-проектами"]'),
('faculty-61a2d84bbbee','group_1','g_main','["ЭВМ"]'),
('faculty-7be8ccfae298','group_1','g_main','["Ин. яз. в ПД"]'),
('faculty-378d62525c55','group_6','g_25290907_1091','["УП.04.01 Учебная практика"]'),
('faculty-5193b5223adc','group_3','g_23290907_2092','["МДК.02.01 ТРПО"]'),
('faculty-5193b5223adc','group_6','g_25290907_1091','["ИТ лр"]'),
('faculty-bc821b0a3ad8','group_6','g_25290907_1091','["МДК.07.01 Оператор беспилотных авиационных систем"]'),
('faculty-a74a84123f7c','group_2','g_26290911_3111','["Ин. яз. в ПД"]'),
('faculty-87486acd5b71','group_1','g_main','["Физ. культура"]'),
('faculty-e6a9156d6f1b','group_3','g_23290907_2092','["Основы философии"]'),
('faculty-f85890a8a60c','group_6','g_25290907_1091','["ОПБД"]'),
('faculty-3ba58257825a','group_6','g_25290907_1091','["ОАП"]'),
('faculty-e873dedba45e','group_3','g_23290907_2092','["Физ. культура"]'),
('faculty-e873dedba45e','group_6','g_25290907_1091','["Физ. культура"]'),
('faculty-3c7319fda0f2','group_6','g_25290907_1091','["ДМ с ЭМЛ"]'),
('faculty-3c7319fda0f2','group_1','g_main','["ДМ с ЭМЛ"]'),
('faculty-3c7319fda0f2','group_2','g_26290911_3111','["ДМ с ЭМЛ"]'),
('faculty-f72122972383','group_4','g_24290907_2092','["Психология общения"]'),
('faculty-f01395cdd5e0','group_6','g_25290907_1091','["БЖД"]'),
('faculty-d4bc1b1889da','group_6','g_25290907_1091','["МДК.04.01 Внедрение и поддержка КС"]'),
('faculty-d4bc1b1889da','group_1','g_main','["Компьютерные сети"]'),
('faculty-ae2fa48b91f9','group_4','g_24290907_2092','["Програм. в 1С:Предпр. 8"]'),
('faculty-7fcb23eb3eee','group_6','g_25290907_1091','["УП.04.01 Учебная практика"]'),
('faculty-7aa81fc8312f','group_4','g_24290907_2092','["Физ. культура"]'),
('faculty-8f64619aab36','group_4','g_24290907_2092','["МДК.01.01 Разработка программных модулей"]'),
('faculty-c58749eac54b','group_2','g_26290911_3111','["МДК.07.01 Оператор беспилотных авиационных систем"]'),
('faculty-c439f84349b4','group_1','g_main','["МДК.04.01 Техн. созд., администр. и анал. информ. ресурсов"]'),
('faculty-68f0ca0ffbfd','group_3','g_23290907_2092','["Ин. яз. в ПД"]'),
('faculty-68f0ca0ffbfd','group_6','g_25290907_1091','["Ин. яз. в ПД"]'),
('faculty-5378de79d42c','group_1','g_main','["БЖД"]'),
('faculty-a495f649adf4','group_4','g_24290907_2092','["Правовое обеспечение ПД"]'),
('faculty-be432be381f9','group_2','g_26290911_3111','["Физ. культура"]'),
('faculty-3e3e72a1b0a2','group_2','g_26290911_3111','["Матем. аппарат в отр. ИТ"]'),
('faculty-ec314451fd1e','group_4','g_24290907_2092','["Ин. яз. в ПД"]'),
('faculty-ec314451fd1e','group_6','g_25290907_1091','["Ин. яз. в ПД"]'),
('faculty-982829b192b3','group_1','g_main','["ОАП_лр"]'),
('faculty-982829b192b3','group_2','g_26290911_3111','["ИТ в ПД лр"]'),
('faculty-433728c880fc','group_3','g_23290907_2092','["МДК.02.02 ИСРПО"]'),
('faculty-c5bb74ed5fbc','group_6','g_25290907_1091','["История ОГСЭ"]'),
('faculty-8b0d83aa0c37','group_4','g_24290907_2092','["МДК.11.01 ТРиЗБД"]'),
('faculty-ee0b3ca367e5','group_6','g_25290907_1091','["МДК.12.01 Техн. созд., админ. и анал. информ. ресур."]'),
('faculty-ee0b3ca367e5','group_2','g_26290911_3111','["Основы работы с информацией"]'),
('faculty-65a1d3c4ffc7','group_3','g_23290907_2092','["МДК.01.03 Разработка мобильных приложений"]');
create function politeshik_private.faculty_request(p_name text) returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();identity text;old politeshik_private.faculty_claims;begin
 if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null) then raise exception 'Войдите в аккаунт с почтой' using errcode='42501';end if;
 select id into identity from politeshik_private.faculty_directory where name=btrim(p_name);
 if identity is null then raise exception 'Выберите полное ФИО из списка преподавателей';end if;
 select * into old from politeshik_private.faculty_claims where uid=actor for update;
 if found then
  if old.faculty_id<>identity or old.status in('banned','rejected') then raise exception 'Заявка уже рассмотрена или связана с другим ФИО. Обратитесь к Админу Арине' using errcode='42501';end if;
  return true;
 end if;
 if exists(select 1 from public.members where uid=actor) or exists(select 1 from public.docs where path='profiles/'||actor::text and coalesce(data->>'rid','')<>'') then raise exception 'Этот аккаунт уже связан с другим кабинетом' using errcode='42501';end if;
 insert into politeshik_private.faculty_claims(uid,faculty_id) values(actor,identity);return true;
end $$;
create function politeshik_private.faculty_context() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare claim politeshik_private.faculty_claims;identity politeshik_private.faculty_directory;groups jsonb;begin
 if auth.uid() is null then raise exception 'Войдите в аккаунт' using errcode='42501';end if;
 select * into claim from politeshik_private.faculty_claims where uid=auth.uid();
 if not found then return jsonb_build_object('matched',false);end if;
 select * into identity from politeshik_private.faculty_directory where id=claim.faculty_id;
 if claim.status<>'approved' then return jsonb_build_object('matched',true,'status',claim.status,'name',identity.name);end if;
 if not exists(select 1 from public.members m join auth.users u on u.id=m.uid
  where m.uid=auth.uid() and m.role='teacher' and m.status='approved' and m.requested_role='teacher' and u.email_confirmed_at is not null) then return jsonb_build_object('matched',true,'status','banned','name',identity.name);end if;
 select coalesce(jsonb_agg(jsonb_build_object('tenant_id',s.tenant_id,'group_id',s.group_id,'name',g.name,'number',substring(g.name from '[0-9]{8}/[0-9]{4}'),'subjects',s.subjects,'students',(select count(*) from public.roster r where r.tenant_id=s.tenant_id and r.flag='')) order by s.tenant_id),'[]') into groups
 from politeshik_private.faculty_scopes s join public.groups g on g.id=s.group_id and g.tenant_id=s.tenant_id where s.faculty_id=identity.id;
 return jsonb_build_object('matched',true,'active',true,'status','approved','name',identity.name,'teacher',identity.teacher_key,'schedule_file',identity.schedule_file,'groups',groups);
end $$;
create function politeshik_private.faculty_requests() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not politeshik_private.is_super_admin() then raise exception 'Доступно только Админу Арине' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('uid',c.uid,'name',d.name,'email',u.email,'status',c.status,'created_at',c.created_at) order by c.created_at desc)
 from politeshik_private.faculty_claims c join politeshik_private.faculty_directory d on d.id=c.faculty_id join auth.users u on u.id=c.uid),'[]');
end $$;
create function politeshik_private.faculty_decide(p_uid uuid,p_approve boolean) returns void language plpgsql security definer set search_path='' as $$
declare claim politeshik_private.faculty_claims;identity politeshik_private.faculty_directory;t text;gid text;mail text;begin
 if not politeshik_private.is_super_admin() then raise exception 'Доступно только Админу Арине' using errcode='42501';end if;
 select * into claim from politeshik_private.faculty_claims where uid=p_uid for update;
 if not found then raise exception 'Заявка не найдена';end if;
 if claim.status<>'pending' then raise exception 'Заявка уже рассмотрена';end if;
 if not p_approve then update politeshik_private.faculty_claims set status='rejected',decided_at=now(),decided_by=auth.uid() where uid=p_uid;return;end if;
 select * into identity from politeshik_private.faculty_directory where id=claim.faculty_id for update;
 if exists(select 1 from politeshik_private.faculty_claims where faculty_id=identity.id and status='approved') then raise exception 'Этот преподаватель уже имеет подтверждённый аккаунт';end if;
 if exists(select 1 from public.members where uid=p_uid) or exists(select 1 from public.docs where path='profiles/'||p_uid::text and coalesce(data->>'rid','')<>'') then raise exception 'Аккаунт уже связан с другим кабинетом';end if;
 select tenant_id,group_id into t,gid from politeshik_private.faculty_scopes where faculty_id=identity.id order by tenant_id limit 1;
 if t is null then t:='group_1';select id into gid from public.groups where tenant_id=t order by created_at limit 1;end if;
 select email into mail from auth.users where id=p_uid and email_confirmed_at is not null;
 if mail is null then raise exception 'У аккаунта нет подтверждённой почты';end if;
 insert into public.members(tenant_id,uid,role,status,requested_role,full_name,group_id,email,decided_at,decided_by)
 values(t,p_uid,'teacher','approved','teacher',identity.name,gid,mail,now(),auth.uid());
 insert into public.docs(tenant_id,path,data) values(t,'profiles/'||p_uid::text,jsonb_build_object('name',identity.name,'role','teacher','joined',now()::text)) on conflict(tenant_id,path) do update set data=excluded.data;
 update politeshik_private.faculty_claims set status='approved',decided_at=now(),decided_by=auth.uid() where uid=p_uid;
end $$;
create function politeshik_private.faculty_group_view(p_tenant text,p_month text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare context jsonb:=politeshik_private.faculty_context();scope politeshik_private.faculty_scopes;students jsonb;news jsonb;month_end text;begin
 if coalesce((context->>'active')::boolean,false) is not true then raise exception 'Дождитесь подтверждения Админа Арины' using errcode='42501';end if;
 if p_month is null or p_month !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' then raise exception 'Выберите месяц';end if;
 select * into scope from politeshik_private.faculty_scopes where faculty_id=(select faculty_id from politeshik_private.faculty_claims where uid=auth.uid() and status='approved') and tenant_id=p_tenant;
 if not found then raise exception 'Группа не закреплена за вашим аккаунтом' using errcode='42501';end if;
 month_end:=to_char((p_month||'-01')::date+interval '1 month'-interval '1 day','YYYY-MM-DD');
 select coalesce(jsonb_agg(jsonb_build_object('rid',r.rid,'n',r.n,'name',r.name,'uid',s.uid,'registered',s.uid is not null,'role',s.role,'subgroup',coalesce(s.profile->>'subgroup',r.subgroup,''),
 'marks',coalesce((select jsonb_object_agg(key,value) from jsonb_each(coalesce(s.marks,'{}')) where left(key,7)=p_month),'{}'),
 'certs',coalesce((select jsonb_agg(jsonb_build_object('from',c->>'from','to',c->>'to','confirmed',c->>'confirmed'='true','pairs',coalesce(c->'pairs','[]')))
  from jsonb_array_elements(coalesce(s.certs,'[]')) c where c->>'from'<=month_end and c->>'to'>=p_month||'-01'),'[]')) order by r.n),'[]') into students
 from public.roster r left join lateral(
  select m.uid,m.role,d.data as profile,a.data->'marks' as marks,c.data->'items' as certs
  from public.members m join public.docs d on d.tenant_id=m.tenant_id and d.path='profiles/'||m.uid::text and d.data->>'rid'=r.rid
  left join public.docs a on a.tenant_id=m.tenant_id and a.path='attendance/'||m.uid::text
  left join public.docs c on c.tenant_id=m.tenant_id and c.path='certs/'||m.uid::text
  left join public.docs claim on claim.tenant_id=m.tenant_id and claim.path='claims/'||r.rid
  where m.tenant_id=r.tenant_id and m.status='approved' and m.role in('student','admin','developer') and coalesce(m.requested_role,'student')<>'parent'
  order by coalesce(claim.data->>'uid'=m.uid::text,false) desc,m.created_at,m.uid limit 1
 )s on true where r.tenant_id=scope.tenant_id and r.flag='';
 select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'title',n.title,'body',n.body,'date',n.news_date,'created_at',n.created_at) order by n.news_date desc,n.created_at desc),'[]') into news
 from(select id,title,body,news_date,created_at from public.news where tenant_id=scope.tenant_id order by news_date desc,created_at desc limit 30)n;
 return jsonb_build_object('tenant_id',scope.tenant_id,'group_id',scope.group_id,'name',(select name from public.groups where id=scope.group_id),'month',p_month,'students',students,'news',news,'read_only',true);
end $$;

revoke all on function politeshik_private.faculty_request(text) from public,anon;grant execute on function politeshik_private.faculty_request(text) to authenticated;
create function public.faculty_request(p_name text) returns boolean language sql security invoker set search_path='' as $$select politeshik_private.faculty_request(p_name)$$;
revoke all on function public.faculty_request(text) from public,anon;grant execute on function public.faculty_request(text) to authenticated;

revoke all on function politeshik_private.faculty_context() from public,anon;grant execute on function politeshik_private.faculty_context() to authenticated;
create function public.faculty_context() returns jsonb language sql security invoker set search_path='' as $$select politeshik_private.faculty_context()$$;
revoke all on function public.faculty_context() from public,anon;grant execute on function public.faculty_context() to authenticated;

revoke all on function politeshik_private.faculty_requests() from public,anon;grant execute on function politeshik_private.faculty_requests() to authenticated;
create function public.faculty_requests() returns jsonb language sql security invoker set search_path='' as $$select politeshik_private.faculty_requests()$$;
revoke all on function public.faculty_requests() from public,anon;grant execute on function public.faculty_requests() to authenticated;

revoke all on function politeshik_private.faculty_decide(uuid,boolean) from public,anon;grant execute on function politeshik_private.faculty_decide(uuid,boolean) to authenticated;
create function public.faculty_decide(p_uid uuid,p_approve boolean) returns void language sql security invoker set search_path='' as $$select politeshik_private.faculty_decide(p_uid,p_approve)$$;
revoke all on function public.faculty_decide(uuid,boolean) from public,anon;grant execute on function public.faculty_decide(uuid,boolean) to authenticated;

revoke all on function politeshik_private.faculty_group_view(text,text) from public,anon;grant execute on function politeshik_private.faculty_group_view(text,text) to authenticated;
create function public.faculty_group_view(p_tenant text,p_month text) returns jsonb language sql security invoker set search_path='' as $$select politeshik_private.faculty_group_view(p_tenant,p_month)$$;
revoke all on function public.faculty_group_view(text,text) from public,anon;grant execute on function public.faculty_group_view(text,text) to authenticated;

