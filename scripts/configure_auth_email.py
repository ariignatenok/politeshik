"""Configure managed Auth templates + SMTP and activate login notices.

Default is a redacted dry run. --apply requires the project owner's Management
API token and SMTP credentials via environment variables or hidden terminal input.
Never paste those secrets in a chat, commit them, or put them in browser code.
"""
import argparse
import getpass
import json
import os
from pathlib import Path
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
PROJECT = 'mrxqzzaayyaiwyarwqsg'
APP = 'https://ariignatenok.github.io/politeshik/'


def templates():
    result = {'site_url': APP, 'mailer_otp_exp': 600, 'mailer_otp_length': 6,
              'smtp_max_frequency': 60, 'password_min_length': 8,
              'rate_limit_email_sent': 60, 'rate_limit_verify': 30,
              'mailer_notifications_password_changed_enabled': True,
              'mailer_notifications_email_changed_enabled': True}
    names = {'recovery': 'Код восстановления пароля «Политешика»',
             'confirmation': 'Подтвердите почту в «Политешике»',
             'reauthentication': 'Код подтверждения «Политешика»',
             'password_changed_notification': 'Пароль «Политешика» изменён',
             'email_changed_notification': 'Почта «Политешика» изменена'}
    for kind, subject in names.items():
        result['mailer_subjects_' + kind] = subject
        result['mailer_templates_' + kind + '_content'] = (ROOT / 'supabase/email-templates' / (kind + '.html')).read_text()
    return result


def request(token, method, path, payload=None):
    body = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request('https://api.supabase.com/v1/projects/' + PROJECT + path, data=body,
                                 method=method, headers={'Authorization': 'Bearer ' + token,
                                                        'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=40) as response:
            data = response.read()
            return json.loads(data) if data else None
    except urllib.error.HTTPError as error:
        # API bodies may contain secret configuration; never print them.
        raise RuntimeError('Management API request failed, HTTP ' + str(error.code)) from None


def value(name, title, hidden=False, default=''):
    found = os.environ.get(name)
    if found:
        return found
    return (getpass.getpass(title + ': ') if hidden else input(title + ((' [' + default + ']') if default else '') + ': ')).strip() or default


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    payload = templates()
    if not args.apply:
        print(json.dumps({'project': PROJECT, 'apply': False, 'auth_fields': sorted(payload),
                          'smtp_secret_names': ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'LOGIN_DISPATCH_KEY'],
                          'login_notices': 'disabled until successful configuration'}, ensure_ascii=False, indent=2))
        return
    token = value('SUPABASE_ACCESS_TOKEN', 'Supabase Management API token', hidden=True)
    host = value('SMTP_HOST', 'SMTP host')
    port = value('SMTP_PORT', 'SMTP TLS port', default='465')
    user = value('SMTP_USER', 'SMTP user')
    password = value('SMTP_PASS', 'SMTP app password / API key', hidden=True)
    sender = value('SMTP_FROM', 'Verified sender email', default=user)
    if not token or not host or not user or not password or '@' not in sender or port not in ('465', '587'):
        raise SystemExit('Missing SMTP configuration or unsupported TLS port. No changes made.')
    current = request(token, 'GET', '/config/auth')
    urls = {u.strip() for u in (current.get('uri_allow_list') or '').split(',') if u.strip()}
    urls.update([APP, APP + '?recovery=1'])
    payload.update(uri_allow_list=','.join(sorted(urls)), smtp_host=host, smtp_port=port,
                   smtp_user=user, smtp_pass=password, smtp_admin_email=sender, smtp_sender_name='Политешик')
    request(token, 'PATCH', '/config/auth', payload)
    key_rows = request(token, 'POST', '/database/query', {'query': "select v.decrypted_secret as dispatch_key from vault.decrypted_secrets v join politeshik_private.login_mail_settings s on s.dispatch_key_id=v.id;"})
    if not isinstance(key_rows, list) or len(key_rows) != 1 or not key_rows[0].get('dispatch_key'):
        raise RuntimeError('Encrypted dispatch key is not configured')
    secrets = dict(SMTP_HOST=host, SMTP_PORT=port, SMTP_USER=user, SMTP_PASS=password, SMTP_FROM=sender, LOGIN_DISPATCH_KEY=key_rows[0]['dispatch_key'])
    request(token, 'POST', '/secrets', [{'name': name, 'value': val} for name, val in secrets.items()])
    request(token, 'POST', '/database/query', {'query': "update politeshik_private.login_mail_settings set enabled=true where singleton;"})
    verified = request(token, 'GET', '/config/auth')
    assert verified.get('smtp_host') and '{{ .Token }}' in verified.get('mailer_templates_recovery_content', ''), 'Configuration verification failed'
    print('Auth email templates, SMTP and login notices configured. Test one real recovery email and one password login.')


if __name__ == '__main__':
    main()
