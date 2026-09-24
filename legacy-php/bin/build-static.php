<?php

declare(strict_types=1);

/**
 * Builds a static copy of the public site into dist/ for hosts that can't run
 * PHP (Netlify). It renders the real views through the real controllers, so
 * the output can't drift from the PHP site.
 *
 * What the static build cannot do: the admin dashboard, database-backed
 * booking requests, CSRF and rate limiting all need PHP. Booking still works
 * through the Calendly popup, and the request form is submitted to Netlify
 * Forms instead (see app/Views/booking/show.php, $staticMode).
 *
 *   npm run build                # compile Tailwind first
 *   php bin/build-static.php --url=https://your-site.netlify.app
 */

use App\Controllers\BookingController;
use App\Controllers\HomeController;
use App\Controllers\PageController;
use App\Core\Config;
use App\Core\Database;
use App\Core\Migrator;
use App\Core\Request;
use App\Core\Response;
use App\Core\View;
use App\Repositories\SettingsRepository;

$config = require dirname(__DIR__) . '/config/bootstrap.php';
require dirname(__DIR__) . '/app/Core/helpers.php';

$options = getopt('', ['url::', 'out::']);
$baseUrl = rtrim((string) ($options['url'] ?? getenv('STATIC_SITE_URL') ?: $config['app']['url']), '/');
$outDir = (string) ($options['out'] ?? BASE_PATH . '/dist');

$config['app']['url'] = $baseUrl;
Config::set($config);
$_SESSION = [];

// Controllers call header() (harmless on the web, warns in a CLI build once any
// output exists). Ignore exactly that; turn every other warning into a hard
// failure so a real problem can never be written into dist/ unnoticed.
set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
    if (str_contains($message, 'Cannot modify header information')) {
        return true;
    }
    throw new ErrorException($message, 0, $severity, $file, $line);
});

if (!is_file(BASE_PATH . '/public/assets/css/app.css')) {
    fwrite(STDERR, "public/assets/css/app.css is missing. Run `npm run build` first.\n");
    exit(1);
}

(new Migrator(Database::connection()))->run(BASE_PATH . '/database/migrations');

$settingsRepo = new SettingsRepository();
$settings = $settingsRepo->all();
$calendlyUrl = ($settings['calendly_url'] ?? '') ?: (string) Config::get('booking.calendly_url', '');

View::share([
    'brandName' => Config::get('app.name'),
    'calendlyUrl' => $calendlyUrl,
    'staticMode' => true,
]);

// -- Start from a clean dist/ -------------------------------------------------

function removeTree(string $dir): void
{
    if (!is_dir($dir)) {
        return;
    }
    foreach (new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    ) as $item) {
        $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname());
    }
    rmdir($dir);
}

if (basename($outDir) !== 'dist') {
    fwrite(STDERR, "Refusing to delete and rebuild '{$outDir}': the output directory must be named 'dist'.\n");
    exit(1);
}
removeTree($outDir);
mkdir($outDir, 0775, true);

function writeFile(string $outDir, string $relative, string $contents): void
{
    $path = $outDir . '/' . ltrim($relative, '/');
    if (!is_dir(dirname($path))) {
        mkdir(dirname($path), 0775, true);
    }
    file_put_contents($path, $contents);
    echo "  wrote {$relative}\n";
}

function capture(string $uri, callable $render): string
{
    $_SERVER['REQUEST_URI'] = $uri;
    ob_start();
    try {
        $render(new Request([], [], ['REQUEST_METHOD' => 'GET', 'REQUEST_URI' => $uri]));
        return (string) ob_get_contents();
    } finally {
        ob_end_clean();
    }
}

// -- Pages -----------------------------------------------------------------------

echo "Rendering pages...\n";
writeFile($outDir, 'index.html', capture('/', fn ($r) => (new HomeController())->index($r)));
writeFile($outDir, 'booking/index.html', capture('/booking/', fn ($r) => (new BookingController())->show($r)));
writeFile($outDir, 'privacy/index.html', capture('/privacy/', fn ($r) => (new HomeController())->privacy($r)));

$brand = $settings['brand_name'] ?? Config::get('app.name');
writeFile($outDir, 'booking/thanks/index.html', capture('/booking/thanks/', fn () => print View::render('booking/thanks', [
    'settings' => $settings,
    'seoTitle' => 'Request sent — ' . $brand,
    'noindex' => true,
])));
writeFile($outDir, '404.html', capture('/404', fn () => print View::render('errors/404', [
    'settings' => $settings,
    'seoTitle' => 'Page not found — ' . $brand,
    'noindex' => true,
])));

writeFile($outDir, 'robots.txt', capture('/robots.txt', fn ($r) => (new PageController())->robots($r)));
// Netlify serves folder pages with a trailing slash (and 301s the bare form),
// so list the final URLs rather than ones that redirect.
$sitemap = capture('/sitemap.xml', fn ($r) => (new PageController())->sitemap($r));
$sitemap = str_replace(['/booking</loc>', '/privacy</loc>'], ['/booking/</loc>', '/privacy/</loc>'], $sitemap);
writeFile($outDir, 'sitemap.xml', $sitemap);

// Same security headers the PHP app sends, in Netlify's _headers format.
$headers = "/*\n";
foreach (Response::headers() as $name => $value) {
    $headers .= "  {$name}: {$value}\n";
}
writeFile($outDir, '_headers', $headers);

// -- Assets (allowlist, so private/local files can never leak into dist/) ------

function copyTree(string $from, string $to): int
{
    if (!is_dir($from)) {
        return 0;
    }
    $count = 0;
    foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($from, FilesystemIterator::SKIP_DOTS)) as $file) {
        $name = $file->getFilename();
        if (str_starts_with($name, '.') || str_ends_with($name, '.md')) {
            continue;
        }
        $relative = substr($file->getPathname(), strlen($from) + 1);
        $target = $to . '/' . str_replace('\\', '/', $relative);
        if (!is_dir(dirname($target))) {
            mkdir(dirname($target), 0775, true);
        }
        copy($file->getPathname(), $target);
        $count++;
    }
    return $count;
}

echo "Copying assets...\n";
$assets = BASE_PATH . '/public/assets';
$copied = 0;
$copied += copyTree($assets . '/js', $outDir . '/assets/js');
$copied += copyTree($assets . '/icons', $outDir . '/assets/icons');
$copied += copyTree($assets . '/video', $outDir . '/assets/video');
$copied += copyTree($assets . '/images/gallery', $outDir . '/assets/images/gallery');
$copied += copyTree($assets . '/images/placeholders', $outDir . '/assets/images/placeholders');
$copied += copyTree(BASE_PATH . '/public/uploads/gallery', $outDir . '/uploads/gallery');
$copied += copyTree(BASE_PATH . '/public/uploads/reviews', $outDir . '/uploads/reviews');

mkdir($outDir . '/assets/css', 0775, true);
copy($assets . '/css/app.css', $outDir . '/assets/css/app.css');
$copied++;

foreach (glob($assets . '/images/favicon*.png') ?: [] as $favicon) {
    if (!is_dir($outDir . '/assets/images')) {
        mkdir($outDir . '/assets/images', 0775, true);
    }
    copy($favicon, $outDir . '/assets/images/' . basename($favicon));
    $copied++;
}

echo "  copied {$copied} asset files\n";
echo "Static site written to {$outDir} for {$baseUrl}\n";
