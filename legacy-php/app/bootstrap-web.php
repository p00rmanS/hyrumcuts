<?php

declare(strict_types=1);

/**
 * The actual front-controller logic, kept outside public/ so the web
 * document root only ever contains a minimal one-line shim. See
 * public/web.php for why.
 */

use App\Core\Config;
use App\Core\Request;
use App\Core\Response;
use App\Core\Router;
use App\Core\Session;
use App\Core\View;
use App\Repositories\SettingsRepository;

$config = require __DIR__ . '/../config/bootstrap.php';
require __DIR__ . '/Core/helpers.php';

Config::set($config);
Session::start();
Response::securityHeaders();

// Shared globally (not just on /booking) so every "Book a Haircut" CTA across
// the site — header, hero, footer, etc. — can open Calendly directly as a
// popup instead of only linking to the /booking page.
$calendlyUrl = (new SettingsRepository())->get('calendly_url', '') ?: (string) Config::get('booking.calendly_url', '');

View::share(['brandName' => Config::get('app.name'), 'calendlyUrl' => $calendlyUrl]);

$router = new Router();
require __DIR__ . '/../routes/web.php';

$request = new Request();

try {
    $router->dispatch($request);
} catch (\Throwable $e) {
    error_log($e->getMessage() . "\n" . $e->getTraceAsString());
    Response::status(500);
    if (Config::get('app.debug')) {
        echo '<pre style="padding:2rem;white-space:pre-wrap;">' . e($e->getMessage() . "\n\n" . $e->getTraceAsString()) . '</pre>';
    } else {
        echo View::render('errors/500');
    }
}
