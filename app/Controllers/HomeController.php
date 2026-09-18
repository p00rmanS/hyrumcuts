<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Core\Request;
use App\Repositories\GalleryRepository;
use App\Repositories\ReviewRepository;
use App\Repositories\SettingsRepository;

final class HomeController extends Controller
{
    public function index(Request $request): void
    {
        $settings = (new SettingsRepository())->all();
        $gallery = new GalleryRepository();

        $this->render('home.index', [
            'settings' => $settings,
            'categories' => $gallery->categories(),
            'items' => $gallery->publicItems(),
            'reviews' => (new ReviewRepository())->approved(),
            'seoTitle' => $settings['seo_title'] ?? config('app.name'),
            'seoDescription' => $settings['seo_description'] ?? '',
        ]);
    }

    public function privacy(Request $request): void
    {
        $settings = (new SettingsRepository())->all();
        $this->render('home.privacy', [
            'settings' => $settings,
            'seoTitle' => 'Privacy Notice — ' . ($settings['brand_name'] ?? config('app.name')),
            'seoDescription' => 'How HyrumHaircuts collects and uses appointment-request information.',
        ]);
    }
}
