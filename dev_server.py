import http.server
import socketserver
import urllib.parse
import os
import datetime

PORT = 3000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

class DevServerHandler(http.server.SimpleHTTPRequestHandler):
    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        clean_path = self.path.split('?')[0].split('#')[0]
        
        # Redirecionamentos de páginas legadas
        if clean_path in ('/slimmaticasuccess.php', '/success.php', '/grazie.html'):
            self.send_response(302)
            self.send_header('Location', '/slimmatica/grazie.html')
            self.end_headers()
            return
        
        # Redirecionamentos legados de produtos renomeados
        if clean_path in ('/balansulin', '/balansulin/', '/balansulin.html'):
            self.send_response(301)
            self.send_header('Location', '/diabexol-pro/')
            self.end_headers()
            return
            
        if clean_path in ('/artizynt', '/artizynt/', '/artizynt.html'):
            self.send_response(301)
            self.send_header('Location', '/prostalis/')
            self.end_headers()
            return

        # Resolução de rotas de produtos para suas pastas
        products = ['slimmatica', 'uroprostan', 'adenofrin', 'diabexol-pro', 'glucortex', 'prostalis']
        
        # Ex: /slimmatica -> redireciona para /slimmatica/
        for prod in products:
            if clean_path == f'/{prod}':
                self.send_response(301)
                self.send_header('Location', f'/{prod}/')
                self.end_headers()
                return
            if clean_path == f'/{prod}.html':
                self.send_response(301)
                self.send_header('Location', f'/{prod}/')
                self.end_headers()
                return

        # Suporte retrocompatível a /style.css e /script.js
        if clean_path == '/style.css':
            self.path = '/assets/css/style.css'
        elif clean_path == '/script.js':
            self.path = '/assets/js/script.js'

        # Suporte retrocompatível a /assets/<imagem> servindo de /assets/images/
        if clean_path.startswith('/assets/') and not clean_path.startswith('/assets/images/') and not clean_path.startswith('/assets/css/') and not clean_path.startswith('/assets/js/'):
            filename = os.path.basename(clean_path)
            img_file = os.path.join(BASE_DIR, 'assets', 'images', filename)
            if os.path.isfile(img_file):
                self.path = f'/assets/images/{filename}'

        super().do_GET()

    def do_POST(self):
        """Processa requisições POST locais simulando o backend PHP da plataforma."""
        content_length = int(self.headers.get('Content-Length', 0))
        post_body = self.rfile.read(content_length).decode('utf-8')
        form_data = urllib.parse.parse_qs(post_body)

        name = form_data.get('name', [''])[0]
        phone = form_data.get('phone', [''])[0]
        country = form_data.get('country', ['IT'])[0]
        lang = form_data.get('lang', ['IT'])[0]
        offer_id = form_data.get('offer_id', ['15495'])[0]

        timestamp = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        print(f"\n[LEAD RECEBIDO COM SUCESSO!]")
        print(f"Data/Hora:  {timestamp}")
        print(f"Nome:       {name}")
        print(f"Telefone:   {phone}")
        print(f"País:       {country} ({lang})")
        print(f"Offer ID:   {offer_id}")
        print(f"Caminho:    {self.path}\n")

        # Salva em leads_backup.csv para verificação
        csv_path = os.path.join(BASE_DIR, 'leads_backup.csv')
        with open(csv_path, 'a', encoding='utf-8') as f:
            f.write(f'"{timestamp}","{name}","{phone}","{country}","{offer_id}","127.0.0.1"\n')

        # Se for Uroprostan, encaminha a requisição real para a API da Netvork
        if 'uroprostan' in self.path:
            netvork_data = {
                'token': 'ed48d1510bf96ccdd2a080314dd3f0ac',
                'offer_id': offer_id if offer_id and offer_id != '15495' else '1465',
                'name': name,
                'phone': phone,
                'country': country,
                'lang': lang.lower() if lang else 'it',
                'ip': '127.0.0.1',
                'url': form_data.get('url', ['https://offertesalute.it/uroprostan/'])[0],
                'utm_source': form_data.get('utm_source', [''])[0],
                'utm_medium': form_data.get('utm_medium', [''])[0],
                'utm_campaign': form_data.get('utm_campaign', [''])[0],
                'utm_content': form_data.get('utm_content', [''])[0],
                'utm_term': form_data.get('utm_term', [''])[0],
                'session_guid': form_data.get('guid', [''])[0],
                'session_first_guid': form_data.get('first_guid', [''])[0],
            }
            try:
                encoded = urllib.parse.urlencode(netvork_data).encode('utf-8')
                req = urllib.request.Request(
                    'https://api.netvork.net/v1/new-lead',
                    data=encoded,
                    headers={'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0'}
                )
                with urllib.request.urlopen(req, timeout=10) as resp:
                    resp_body = resp.read().decode('utf-8')
                    print(f"[NETVORK API RESPOSTA]: {resp.status} - {resp_body}")
            except Exception as e:
                print(f"[NETVORK API AVISO]: {e}")

        # Redireciona com sucesso para a página de obrigado do produto
        if 'uroprostan' in self.path:
            redirect_target = '/uroprostan/uroprostansuccess.html'
        elif 'adenofrin' in self.path:
            redirect_target = '/adenofrin/grazie.html'
        else:
            redirect_target = '/slimmatica/grazie.html'
        self.send_response(303)
        self.send_header('Location', redirect_target)
        self.end_headers()

if __name__ == '__main__':
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), DevServerHandler) as httpd:
        print(f"Servidor de Desenvolvimento ativo em http://0.0.0.0:{PORT}/")
        print("Suporta requisições GET e requisições POST para slimmatica.php")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
