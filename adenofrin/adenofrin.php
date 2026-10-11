<?php

// ==========================================================
// CONFIGURAÇÃO — troque pelos seus dados reais da conta KMA
// ==========================================================
define('KMA_ACCESS_TOKEN', 'LGetGr2KPOuL1kDHrXlm2Zb9msuMVq6Z');
define('KMA_CHANNEL', '2Zj1zc');
define('KMA_DEBUG', false);

// ==========================================================
// CLASSE KmaLead — comunicação com a API da KMA
// ==========================================================
class KmaLead
{
    private $leadUrl = 'https://api.kma.biz/lead/add';
    private $clickUrl = 'https://api.kma.biz/click/make';
    private $token;
    private $headers = [];
    public $debug = false;

    public function __construct($token = '')
    {
        $this->token = $token;
    }

    public function getClick($channel)
    {
        $this->setHeaders();
        $this->setClickHeaders($channel);
        if ($curl = curl_init()) {
            curl_setopt($curl, CURLOPT_URL, $this->clickUrl . "?" . http_build_query($_GET));
            curl_setopt($curl, CURLOPT_HEADER, false);
            curl_setopt($curl, CURLOPT_HTTPHEADER, $this->getHeaders());
            curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($curl, CURLOPT_TIMEOUT, 15);
            $result = curl_exec($curl);
            curl_close($curl);
            header('Content-Type: application/json');
            return $result;
        }
        return "{}";
    }

    public function addLead($data)
    {
        $result = $this->sendRequest($data);
        $array = json_decode($result, true);
        if (isset($array['order'])) {
            return $array['order'];
        }
        if (isset($array['code'], $array['message'])) {
            $this->echoDebugMessage("<strong>Código de erro: {$array['code']}. Mensagem: {$array['message']}</strong>");
        }
        return false;
    }

    public function addLeadAndReturnPage($data)
    {
        return $this->sendRequest($data);
    }

    private function sendRequest($data)
    {
        $this->setHeaders();
        if ($curl = curl_init()) {
            $headers = $this->getHeaders();
            curl_setopt($curl, CURLOPT_URL, $this->leadUrl);
            curl_setopt($curl, CURLOPT_HEADER, true);
            curl_setopt($curl, CURLOPT_HTTPHEADER, $headers);
            curl_setopt($curl, CURLOPT_POST, true);
            curl_setopt($curl, CURLOPT_POSTFIELDS, http_build_query($data));
            curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($curl, CURLINFO_HEADER_OUT, true);
            curl_setopt($curl, CURLOPT_TIMEOUT, 15);
            curl_setopt($curl, CURLOPT_SSL_VERIFYHOST, false);
            curl_setopt($curl, CURLOPT_SSL_VERIFYPEER, false);
            $response = curl_exec($curl);
            $header = substr($response, 0, curl_getinfo($curl, CURLINFO_HEADER_SIZE));
            $result = substr($response, curl_getinfo($curl, CURLINFO_HEADER_SIZE));
            if (in_array(curl_errno($curl), [CURLE_OPERATION_TIMEDOUT]) || curl_getinfo($curl, CURLINFO_RESPONSE_CODE) != 200) {
                try {
                    $fp = fopen(__DIR__ . '/lead-' . sha1(KMA_ACCESS_TOKEN . KMA_CHANNEL) . '.txt', 'a+');
                    fwrite($fp, json_encode(['ts' => time(), 'data' => $data, 'headers' => $headers], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\r\n");
                    fclose($fp);
                } catch (Exception $e) {
                }
                $result = json_encode(['order' => 'X', 'code' => 0, 'message' => 'LOCAL SAVE']);
            }
            $this->echoDebugMessage(curl_getinfo($curl, CURLINFO_HEADER_OUT));
            $this->echoDebugMessage($data);
            $this->echoDebugMessage($header);
            $this->echoDebugMessage($result);
            curl_close($curl);
            return $result;
        }
        return false;
    }

    public function resendRequest($data, $headers)
    {
        if ($curl = curl_init()) {
            curl_setopt($curl, CURLOPT_URL, $this->leadUrl);
            curl_setopt($curl, CURLOPT_HEADER, false);
            curl_setopt($curl, CURLOPT_HTTPHEADER, $headers);
            curl_setopt($curl, CURLOPT_POST, true);
            curl_setopt($curl, CURLOPT_POSTFIELDS, http_build_query($data));
            curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($curl, CURLINFO_HEADER_OUT, true);
            curl_setopt($curl, CURLOPT_TIMEOUT, 5);
            curl_setopt($curl, CURLOPT_SSL_VERIFYHOST, false);
            curl_setopt($curl, CURLOPT_SSL_VERIFYPEER, false);
            $result = curl_exec($curl);
            curl_close($curl);
            return $result;
        }
        return false;
    }

    private function getHeaders()
    {
        array_walk($this->headers, function (&$value, $key) {
            $value = "$key: $value";
        });
        return array_values($this->headers);
    }

    private function setHeaders()
    {
        foreach ($_SERVER as $name => $value) {
            if (substr($name, 0, 5) == 'HTTP_') {
                $this->headers[str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))))] = $value;
            }
        }
        if (isset($this->headers['Host']) && !empty($this->headers['Host'])) {
            $rs = isset($_SERVER['REQUEST_SCHEME']) ? $_SERVER['REQUEST_SCHEME'] : 'http';
            $this->headers['X-Host-Url'] = $rs . "://" . $this->headers['Host'] . $_SERVER['REQUEST_URI'];
        }
        $this->filterHeaders();
        $this->headers['Accept'] = 'application/json';
        $this->headers['Authorization'] = "Bearer {$this->token}";
    }

    private function filterHeaders()
    {
        unset($this->headers['Host']);
        unset($this->headers['Cookie']);
        unset($this->headers['Content-Type']);
        unset($this->headers['Content-Length']);
        unset($this->headers['Referer']);
    }

    private function setClickHeaders($channel)
    {
        $this->headers['X-Forwarded-For'] = $this->getIp();
        $this->headers['X-Kma-Channel'] = $channel;
        if (isset($this->headers['X-Referer']) && !empty($this->headers['X-Referer'])) {
            $this->headers['Referer'] = $this->headers['X-Referer'];
            unset($this->headers['X-Referer']);
        }
    }

    private function echoDebugMessage($data)
    {
        if ($this->debug) {
            if (is_array($data)) {
                echo '<pre>';
                print_r($data);
                echo '</pre>';
            } else {
                echo "<pre>$data</pre>";
            }
        }
    }

    public function getIp()
    {
        foreach ([
                     'HTTP_CF_CONNECTING_IP',
                     'HTTP_X_FORWARDED_FOR',
                     'REMOTE_ADDR',
                 ] as $key) {
            if (array_key_exists($key, $_SERVER)) {
                $ips = explode(',', $_SERVER[$key]);
                $ips = array_map('trim', $ips);
                $ips = array_filter($ips);
                foreach ($ips as $ip) {
                    $ip = filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE);
                    if (!empty($ip)) {
                        return $ip;
                    }
                    $ip = filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6 | FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE);
                    if (!empty($ip)) {
                        return $ip;
                    }
                }
            }
        }
        return '127.0.0.1';
    }
}

// ==========================================================
// PROCESSAMENTO DO FORMULÁRIO
// ==========================================================
if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    $name    = !empty($_POST['name']) ? trim($_POST['name']) : '';
    $phone   = !empty($_POST['phone']) ? trim($_POST['phone']) : '';
    $country = !empty($_POST['country']) ? trim($_POST['country']) : 'IT';
    $offerId = !empty($_POST['offer_id']) ? trim($_POST['offer_id']) : '28221';

    $utmSource   = !empty($_POST['utm_source']) ? trim($_POST['utm_source']) : '';
    $utmMedium   = !empty($_POST['utm_medium']) ? trim($_POST['utm_medium']) : '';
    $utmCampaign = !empty($_POST['utm_campaign']) ? trim($_POST['utm_campaign']) : '';
    $utmContent  = !empty($_POST['utm_content']) ? trim($_POST['utm_content']) : '';
    $utmTerm     = !empty($_POST['utm_term']) ? trim($_POST['utm_term']) : '';

    if (empty($name) || empty($phone) || empty($country)) {
        header('Location: index.html?error=fields');
        exit();
    }

    $lead = new KmaLead(KMA_ACCESS_TOKEN);
    $lead->debug = KMA_DEBUG;

    $data = array(
        'channel'      => KMA_CHANNEL,
        'name'         => $name,
        'phone'        => $phone,
        'ip'           => $lead->getIp(),
        'country'      => $country,
        'referer'      => !empty($_SERVER['HTTP_REFERER']) ? $_SERVER['HTTP_REFERER'] : '',
        'offer'        => $offerId,
        'utm_source'   => $utmSource,
        'utm_medium'   => $utmMedium,
        'utm_campaign' => $utmCampaign,
        'utm_content'  => $utmContent,
        'utm_term'     => $utmTerm,
    );

    $order = $lead->addLead($data);

    if ($order !== false) {
        header('Location: success.php');
    } else {
        header('Location: index.html?error=api');
    }
    exit();
}

header('Location: adenofringrazie.html');
exit();

