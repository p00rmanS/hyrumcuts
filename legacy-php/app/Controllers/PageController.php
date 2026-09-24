<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Core\Request;
use App\Repositories\GalleryRepository;

final class PageController extends Controller
{
    public function robots(Request $request): void
    {
        header('Content-Type: text/plain; charset=utf-8');
        $base = config('app.url');
        echo "User-agent: *\n";
        echo "Disallow: /admin\n";
        echo "Disallow: /booking/manage/\n";
        echo "Allow: /\n\n";
        echo "Sitemap: {$base}/sitemap.xml\n";
    }

    public function sitemap(Request $request): void
    {
        header('Content-Type: application/xml; charset=utf-8');
        $base = config('app.url');
        $urls = [
            ['loc' => $base . '/', 'priority' => '1.0'],
            ['loc' => $base . '/booking', 'priority' => '0.9'],
            ['loc' => $base . '/privacy', 'priority' => '0.2'],
        ];

        echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
        foreach ($urls as $url) {
            echo "  <url><loc>" . e($url['loc']) . "</loc><priority>{$url['priority']}</priority></url>\n";
        }
        echo '</urlset>';
    }
}
