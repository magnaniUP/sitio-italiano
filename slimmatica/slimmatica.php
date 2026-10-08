<?php
/**
 * order.php - envio de leads para a CPAGetti Leads API
 *
 * Formulário esperado: method="POST" action="slimmatica.php"
 * Endpoint documentado/publicamente: https://api.cpagetti.com/order/register
 *
 * Configure as variáveis de ambiente abaixo no servidor:
 *   CPAGETTI_API_KEY       Chave API da sua conta CPAGetti
 *   CPAGETTI_OFFER_ID      ID da oferta
 *   CPAGETTI_COUNTRY       País padrão (ex.: BR)
 *   CPAGETTI_LANG          Idioma padrão (ex.: PT)
 *   CPAGETTI_STREAM_CODE   Código do fluxo, se aplicável
 *   CPAGETTI_THANKYOU_URL  Página de sucesso (padrão: thank-you.html)
 */

declare(strict_types=1);

const CPAGETTI_ENDPOINT = 'https://api.cpagetti.com/order/register';
const MAX_FIELD_LENGTH = 255;

/** Nunca coloque a chave real no código versionado. */
$apiKey = 'BYfsxIxJgbximiUJ6nkJXQMTiYFVoKAE';
$defaultOfferId = '15495';
$defaultCountry = 'IT';
$defaultLang = 'IT';
$defaultStreamCode = 'v29p';
$thankYouUrl = 'grazie.html';

function postValue(string $key, string $default = ''): string
{
    $value = $_POST[$key] ?? $default;
    if (is_array($value)) {
        return '';
    }

    return trim((string) $value);
}

function fieldLength(string $value): int
{
    return function_exists('mb_strlen') ? mb_strlen($value) : strlen($value);
}

function clientIp(): ?string
{
    // Não confie em X-Forwarded-For sem conhecer/proteger o seu proxy.
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : null;
}

function writeLog(string $filename, string $message): void
{
    // O diretório deve estar protegido contra acesso público no servidor.
    @file_put_contents(
        __DIR__ . '/' . $filename,
        '[' . date('c') . '] ' . $message . PHP_EOL,
        FILE_APPEND | LOCK_EX
    );
}

function failResponse(string $message, int $status = 400): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(
        ['success' => false, 'message' => $message],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    failResponse('Método não permitido. Use POST.', 405);
}

if ($apiKey === '') {
    writeLog('order.error.log', 'CPAGETTI_API_KEY não configurada.');
    failResponse('A integração ainda não foi configurada no servidor.', 500);
}

$name = postValue('name');
$phone = postValue('phone');
$offerId = postValue('offer_id', $defaultOfferId);
$country = strtoupper(postValue('country', $defaultCountry));
$lang = strtoupper(postValue('lang', $defaultLang));
$streamCode = postValue('stream_code', $defaultStreamCode);

if ($name === '' || $phone === '' || $offerId === '' || $country === '' || $lang === '') {
    failResponse('Preencha nome, telefone, oferta, país e idioma.');
}

foreach (['name' => $name, 'phone' => $phone, 'offer_id' => $offerId,
          'country' => $country, 'lang' => $lang, 'stream_code' => $streamCode] as $field => $value) {
    if (fieldLength($value) > MAX_FIELD_LENGTH) {
        failResponse("O campo {$field} excede o tamanho permitido.");
    }
}

// A CPAGetti aceita campos de atribuição opcionais para rastreamento.
$order = [
    'api_key' => $apiKey,
    'name' => $name,
    'phone' => $phone,
    'offer_id' => $offerId,
    'country' => $country,
    'lang' => $lang,
    'ip' => clientIp(),
    'stream_code' => $streamCode,
    'sub1' => postValue('sub1'),
    'sub2' => postValue('sub2'),
    'sub3' => postValue('sub3'),
    'sub4' => postValue('sub4'),
    'sub5' => postValue('sub5'),
];

// Remove valores nulos/vazios opcionais, mantendo os campos obrigatórios.
$order = array_filter($order, static fn ($value): bool => $value !== null && $value !== '');

$forwardedHeaders = [
    'Content-Type: application/x-www-form-urlencoded',
    'Accept: application/json',
    'User-Agent: ' . substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? 'lead-form'), 0, 200),
];

$curl = curl_init(CPAGETTI_ENDPOINT);
if ($curl === false) {
    writeLog('order.error.log', 'Não foi possível inicializar o cURL.');
    failResponse('Falha interna ao preparar o envio.', 500);
}

curl_setopt_array($curl, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => http_build_query($order, '', '&', PHP_QUERY_RFC3986),
    CURLOPT_HTTPHEADER => $forwardedHeaders,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 25,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
]);

$responseBody = curl_exec($curl);
$curlError = curl_error($curl);
$httpCode = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
curl_close($curl);

if ($responseBody === false || $responseBody === '') {
    writeLog('order.error.log', 'Falha cURL; HTTP ' . $httpCode . '; erro: ' . $curlError);
    failResponse('Não foi possível enviar o lead. Tente novamente.', 502);
}

$response = json_decode($responseBody, true);
if (!is_array($response)) {
    writeLog('order.error.log', 'Resposta inválida; HTTP ' . $httpCode . '; corpo: ' . substr($responseBody, 0, 1000));
    failResponse('A plataforma retornou uma resposta inválida.', 502);
}

if (($response['success'] ?? false) !== true) {
    // Não grava nome/telefone/chave no log.
    $errorId = $response['error'] ?? $response['message'] ?? 'lead rejeitado pela CPAGetti';
    writeLog('order.error.log', 'Lead rejeitado; HTTP ' . $httpCode . '; motivo: ' . substr((string) $errorId, 0, 500));
    failResponse('A plataforma não aceitou o lead. Verifique os dados da oferta.', 422);
}

$orderId = isset($response['id']) ? (string) $response['id'] : 'sem-id';
writeLog('order.success.log', 'Lead aceito; HTTP ' . $httpCode . '; id: ' . substr($orderId, 0, 100));

// Redirecionamento apenas para URL local/configurada; não use um valor vindo do POST.
header('Location: ' . $thankYouUrl, true, 303);
exit;
