<?php

declare(strict_types=1);

if (PHP_SAPI === 'cli-server') {
    $assetPath = realpath(__DIR__ . parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
    if ($assetPath !== false && str_starts_with($assetPath, realpath(__DIR__)) && is_file($assetPath)) {
        return false;
    }
}

require dirname(__DIR__) . '/app/bootstrap-web.php';