"""CDP pipe driver from Point de rupture banc-rendu.py. No listening port."""
import os,fcntl,subprocess,time,select,json
class Tube:
    """Chrome piloté par --remote-debugging-pipe : il lit les commandes sur le descripteur 3 et écrit sur le 4,
    messages JSON terminés par un octet nul. Aucun port n'est ouvert."""

    def __init__(self, chrome, drapeaux, journal):
        vers_chrome_lu, self.ecrit = os.pipe()
        self.lu, de_chrome_ecrit = os.pipe()
        # Hors de portée de 3 et 4, pour que dup2 ne s'écrase pas lui-même dans le fils.
        hauts = [fcntl.fcntl(fd, fcntl.F_DUPFD_CLOEXEC, 10) for fd in (vers_chrome_lu, de_chrome_ecrit)]
        os.close(vers_chrome_lu)
        os.close(de_chrome_ecrit)

        def preparer():
            os.dup2(hauts[0], 3)
            os.dup2(hauts[1], 4)

        # close_fds=False : tout ce que Python ouvre est déjà marqué « fermé à l'exec » ; seuls 0, 1, 2, 3 et 4 passent.
        self.proc = subprocess.Popen([chrome, *drapeaux], stdin=subprocess.DEVNULL, stdout=journal, stderr=journal,
                                     close_fds=False, preexec_fn=preparer)
        for fd in hauts:
            os.close(fd)
        self.tampon = b''
        self.n = 0
        self.evenements = []

    def lire(self, delai):
        fin = time.monotonic() + delai
        while b'\0' not in self.tampon:
            reste = fin - time.monotonic()
            if reste <= 0:
                raise TimeoutError('Chrome ne répond pas')
            prets, _, _ = select.select([self.lu], [], [], reste)
            if prets:
                bloc = os.read(self.lu, 1 << 20)
                if not bloc:
                    raise RuntimeError('Chrome a fermé le tube (code ' + str(self.proc.poll()) + ')')
                self.tampon += bloc
        message, _, self.tampon = self.tampon.partition(b'\0')
        return json.loads(message)

    def envoyer(self, methode, params=None, session=None, delai=60):
        self.n += 1
        m = {'id': self.n, 'method': methode, 'params': params or {}}
        if session:
            m['sessionId'] = session
        donnees = json.dumps(m).encode() + b'\0'
        while donnees:
            donnees = donnees[os.write(self.ecrit, donnees):]
        while True:
            r = self.lire(delai)
            if r.get('id') == self.n:
                if 'error' in r:
                    raise RuntimeError(methode + ' : ' + json.dumps(r['error'], ensure_ascii=False))
                return r.get('result', {})
            self.evenements.append(r)

    def fermer(self):
        for fd in (self.ecrit, self.lu):
            try:
                os.close(fd)
            except OSError:
                pass
        try:
            self.proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            self.proc.kill()
            self.proc.wait(timeout=10)

