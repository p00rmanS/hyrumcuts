<?php

declare(strict_types=1);

use App\Controllers\Admin\AuthController as AdminAuthController;
use App\Controllers\Admin\BookingController as AdminBookingController;
use App\Controllers\Admin\DashboardController as AdminDashboardController;
use App\Controllers\Admin\GalleryController as AdminGalleryController;
use App\Controllers\Admin\ReviewController as AdminReviewController;
use App\Controllers\Admin\ServiceController as AdminServiceController;
use App\Controllers\Admin\SettingsController as AdminSettingsController;
use App\Controllers\BookingController;
use App\Controllers\HomeController;
use App\Controllers\PageController;
use App\Core\Router;

/** @var Router $router */

// -- Public site -----------------------------------------------------
$router->get('/', [HomeController::class, 'index']);
$router->get('/privacy', [HomeController::class, 'privacy']);

$router->get('/booking', [BookingController::class, 'show']);
$router->post('/booking', [BookingController::class, 'store']);
$router->get('/booking/manage/{token}', [BookingController::class, 'manage']);
$router->post('/booking/manage/{token}/cancel', [BookingController::class, 'cancel']);

$router->get('/robots.txt', [PageController::class, 'robots']);
$router->get('/sitemap.xml', [PageController::class, 'sitemap']);

// -- Admin -------------------------------------------------------------
$router->get('/admin/login', [AdminAuthController::class, 'showLogin']);
$router->post('/admin/login', [AdminAuthController::class, 'login']);
$router->post('/admin/logout', [AdminAuthController::class, 'logout']);

$router->get('/admin', [AdminDashboardController::class, 'index']);

$router->get('/admin/bookings', [AdminBookingController::class, 'index']);
$router->get('/admin/bookings/{id}', [AdminBookingController::class, 'show']);
$router->post('/admin/bookings/{id}/status', [AdminBookingController::class, 'updateStatus']);
$router->post('/admin/bookings/{id}/notes', [AdminBookingController::class, 'updateNotes']);

$router->get('/admin/gallery', [AdminGalleryController::class, 'index']);
$router->get('/admin/gallery/create', [AdminGalleryController::class, 'create']);
$router->post('/admin/gallery', [AdminGalleryController::class, 'store']);
$router->get('/admin/gallery/{id}/edit', [AdminGalleryController::class, 'edit']);
$router->post('/admin/gallery/{id}', [AdminGalleryController::class, 'update']);
$router->post('/admin/gallery/{id}/delete', [AdminGalleryController::class, 'destroy']);
$router->post('/admin/gallery/reorder', [AdminGalleryController::class, 'reorder']);
$router->post('/admin/gallery-categories', [AdminGalleryController::class, 'storeCategory']);
$router->post('/admin/gallery-categories/{id}', [AdminGalleryController::class, 'updateCategory']);
$router->post('/admin/gallery-categories/{id}/delete', [AdminGalleryController::class, 'destroyCategory']);

$router->get('/admin/reviews', [AdminReviewController::class, 'index']);
$router->post('/admin/reviews', [AdminReviewController::class, 'store']);
$router->post('/admin/reviews/{id}', [AdminReviewController::class, 'update']);
$router->post('/admin/reviews/{id}/delete', [AdminReviewController::class, 'destroy']);

$router->get('/admin/services', [AdminServiceController::class, 'index']);
$router->post('/admin/services', [AdminServiceController::class, 'store']);
$router->post('/admin/services/{id}', [AdminServiceController::class, 'update']);
$router->post('/admin/services/{id}/delete', [AdminServiceController::class, 'destroy']);

$router->get('/admin/settings', [AdminSettingsController::class, 'index']);
$router->post('/admin/settings', [AdminSettingsController::class, 'update']);
