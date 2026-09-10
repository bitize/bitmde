#!/usr/bin/env sh
#
# Gera um certificado autoassinado descartável em certs/, suficiente para rodar a
# suíte de testes sem um certificado A1 real. NÃO serve para falar com a SEFAZ:
# sefaz.test.js continua exigindo um certificado ICP-Brasil válido.
#
set -e

DIR='certs'
SENHA='senha-de-teste'

if [ -e "$DIR" ]; then
  echo "ERRO: $DIR/ já existe. Abortando para não sobrescrever um certificado real." >&2
  echo "Remova o diretório manualmente se quiser regerar." >&2
  exit 1
fi

# O Git Bash converte o argumento de -subj em caminho do Windows; inofensivo no Linux.
MSYS_NO_PATHCONV=1
export MSYS_NO_PATHCONV

mkdir -p "$DIR"

openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
  -keyout "$DIR/key.pem" -out "$DIR/cert.pem" \
  -subj '/C=BR/ST=SP/O=Bitize/CN=bitmde teste' 2>/dev/null

printf '%s' "$SENHA" >"$DIR/passphrase.txt"

# PBE-SHA1-3DES é obrigatório: o padrão do OpenSSL 3 (AES-256-CBC + PBKDF2) não é
# decifrável pelo node-forge, e todo teste que carrega o .pfx falharia.
openssl pkcs12 -export -out "$DIR/certificado.pfx" \
  -inkey "$DIR/key.pem" -in "$DIR/cert.pem" \
  -passout "pass:$SENHA" \
  -keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES -macalg sha1

# certificado.test.js compara a saída de p12ToPem com estes arquivos, byte a byte.
# O node-forge emite PEM com CRLF; o OpenSSL emite LF no Linux. Normaliza para CRLF.
for f in "$DIR/cert.pem" "$DIR/key.pem"; do
  awk '{ sub(/\r$/, ""); printf "%s\r\n", $0 }' "$f" >"$f.tmp"
  mv "$f.tmp" "$f"
done

echo "Certificado de teste gerado em $DIR/"
