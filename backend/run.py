import os
from app import create_app

app = create_app()

if __name__ == '__main__':
    # Caminhos possíveis para os certificados (relativos ao diretório backend)
    certs = [
        ('../gapb-app/certificados/192.168.1.233.pem', '../gapb-app/certificados/192.168.1.233-key.pem'),
        ('../gapb-app/certificados/cert.crt', '../gapb-app/certificados/cert.key')
    ]
    
    ssl_ctx = None
    for cert, key in certs:
        if os.path.exists(cert) and os.path.exists(key):
            ssl_ctx = (cert, key)
            print(f"Certificados SSL detectados: {cert}")
            break
            
    if ssl_ctx:
        print("Iniciando Flask com SSL (HTTPS)...")
        app.run(host='0.0.0.0', port=5000, debug=True, ssl_context=ssl_ctx)
    else:
        print("Iniciando Flask em modo HTTP normal...")
        app.run(host='0.0.0.0', port=5000, debug=True)

