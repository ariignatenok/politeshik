-- Subject identifiers are embedded in legacy selectors; only text-safe identifier characters are accepted.
alter table politeshik_private.homework_proposals add constraint homework_proposals_safe_subject_id
 check(subject_id ~ '^[[:alnum:]_ ./()+,:-]+$');
