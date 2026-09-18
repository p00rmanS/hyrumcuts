<?php

declare(strict_types=1);

/**
 * Development seed data. Everything inserted here is obviously fictional
 * placeholder content (settings left blank, [Placeholder] reviews, generated
 * neutral placeholder images) so it is safe and easy to spot before launch.
 * Re-running this script is safe: it never overwrites existing rows.
 */

use App\Core\Config;
use App\Core\Database;
use App\Core\Migrator;

$config = require dirname(__DIR__) . '/config/bootstrap.php';
Config::set($config);

$pdo = Database::connection();
(new Migrator($pdo))->run(dirname(__DIR__) . '/database/migrations');

$now = gmdate('Y-m-d H:i:s');

// ---------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------
$settings = [
    'brand_name' => 'HyrumHaircuts',
    'barber_name' => 'Hyrum',
    'hero_eyebrow' => 'Precision cuts. Personal style.',
    'hero_heading' => 'A sharper look, cut for you.',
    'hero_subheading' => 'Modern cuts, clean fades, and detail-first grooming by Hyrum.',
    'about_bio' => "Hyrum approaches every appointment with patience, precision, and attention to how the cut fits the person—not just the trend. From clean fades to longer textured styles, the goal is a haircut that looks sharp in the chair and still works in everyday life.",
    'about_specialties' => '',
    'about_location' => '',
    'about_availability_note' => '',
    'about_contact_method' => '',
    'instagram_url' => '',
    'facebook_url' => '',
    'phone' => '',
    'email' => '',
    'location_general' => '',
    'timezone' => (string) Config::get('app.timezone', 'America/Denver'),
    'booking_policy' => '',
    'faq_book' => 'Send an appointment request through the booking page, or pick an open time directly on the calendar if one is available. Either way you will hear back to lock in the details.',
    'faq_confirmed' => "Hyrum personally reviews and confirms every request by text or email, usually the same day.",
    'faq_reference' => '[Owner to review: what reference photos or details are most helpful before an appointment?]',
    'faq_reschedule' => '[Owner to review: reschedule/cancellation policy and how much notice is needed.]',
    'faq_confirmation' => 'By the contact method you provide on the request form (text or email).',
    'seo_title' => 'HyrumHaircuts — Precision Cuts, Personal Style',
    'seo_description' => 'Browse HyrumHaircuts\' portfolio of fades, tapers, and textured cuts, then request an appointment with Hyrum.',
    'calendly_url' => (string) Config::get('booking.calendly_url', ''),
    'map_url' => '',
    'address_full' => '',
    'credit_text' => '',
    'privacy_contact_email' => '',
    'analytics_provider' => '',
    'analytics_site_id' => '',
    'preferred_time_windows' => "Morning (9am\xE2\x80\x9312pm)|Early afternoon (12pm\xE2\x80\x933pm)|Late afternoon (3pm\xE2\x80\x936pm)|Evening (6pm\xE2\x80\x938pm)",
];

$insertSetting = $pdo->prepare('INSERT OR IGNORE INTO settings (setting_key, setting_value, updated_at) VALUES (:k, :v, :now)');
foreach ($settings as $key => $value) {
    $insertSetting->execute(['k' => $key, 'v' => $value, 'now' => $now]);
}
echo "Settings seeded (existing values were not overwritten).\n";

// ---------------------------------------------------------------------
// Services (no prices, ever)
// ---------------------------------------------------------------------
$serviceCount = (int) $pdo->query('SELECT COUNT(*) FROM services')->fetchColumn();
if ($serviceCount === 0) {
    $services = [
        ['Classic Haircut', 'A timeless cut, tailored to face shape and hair type.'],
        ['Skin Fade', 'A close, blended fade from skin to length on top.'],
        ['Taper Fade', 'A gradual blend that keeps more length through the sides.'],
        ['Textured Crop', 'Shorter sides with a textured, low-maintenance top.'],
        ['Beard Trim & Lineup', 'Beard shaping and a clean lineup.'],
        ['Haircut + Beard Combo', 'A full haircut paired with a beard trim and lineup.'],
        ['Kids Haircut', 'A patient, straightforward cut for younger clients.'],
    ];
    $insertService = $pdo->prepare(
        'INSERT INTO services (name, description, is_active, display_order, created_at, updated_at)
         VALUES (:name, :description, 1, :order, :now, :now)'
    );
    foreach ($services as $i => [$name, $description]) {
        $insertService->execute(['name' => $name, 'description' => $description, 'order' => $i, 'now' => $now]);
    }
    echo count($services) . " service(s) seeded.\n";
} else {
    echo "Services already present, skipped.\n";
}

// ---------------------------------------------------------------------
// Gallery categories
// ---------------------------------------------------------------------
$categoryCount = (int) $pdo->query('SELECT COUNT(*) FROM gallery_categories')->fetchColumn();
$categories = [
    ['fades', 'Fades'],
    ['tapers', 'Tapers'],
    ['textured', 'Textured'],
    ['long-hair', 'Long Hair'],
    ['beards', 'Beards'],
    ['transformations', 'Transformations'],
];
if ($categoryCount === 0) {
    $insertCategory = $pdo->prepare(
        'INSERT INTO gallery_categories (slug, name, display_order, created_at, updated_at)
         VALUES (:slug, :name, :order, :now, :now)'
    );
    foreach ($categories as $i => [$slug, $name]) {
        $insertCategory->execute(['slug' => $slug, 'name' => $name, 'order' => $i, 'now' => $now]);
    }
    echo count($categories) . " gallery categor(y/ies) seeded.\n";
} else {
    echo "Gallery categories already present, skipped.\n";
}

// ---------------------------------------------------------------------
// Gallery items + generated neutral placeholder images
// ---------------------------------------------------------------------
$itemCount = (int) $pdo->query('SELECT COUNT(*) FROM gallery_items')->fetchColumn();
if ($itemCount === 0) {
    require __DIR__ . '/../app/Core/PlaceholderImage.php';

    $categoryIds = [];
    foreach ($pdo->query('SELECT id, slug FROM gallery_categories') as $row) {
        $categoryIds[$row['slug']] = (int) $row['id'];
    }

    // [slug, title, orientation]  orientation: portrait | square | landscape
    $items = [
        ['fades', 'Clean Skin Fade', 'portrait'],
        ['fades', 'High Fade with Hard Part', 'square'],
        ['fades', 'Low Fade, Natural Top', 'portrait'],
        ['tapers', 'Classic Taper', 'portrait'],
        ['tapers', 'Taper with Beard Lineup', 'square'],
        ['textured', 'Textured Crop', 'portrait'],
        ['textured', 'Textured Fringe', 'square'],
        ['long-hair', 'Longer Textured Style', 'portrait'],
        ['long-hair', 'Swept-Back Long Style', 'landscape'],
        ['beards', 'Beard Shape-Up', 'square'],
        ['beards', 'Full Beard Trim', 'portrait'],
    ];

    $insertItem = $pdo->prepare(
        'INSERT INTO gallery_items (category_id, title, description, alt_text, is_featured, is_transformation, display_order, created_at, updated_at)
         VALUES (:category_id, :title, :description, :alt_text, :featured, 0, :order, :now, :now)'
    );
    $insertMedia = $pdo->prepare(
        'INSERT INTO gallery_media (gallery_item_id, role, image_path, width, height, display_order, created_at)
         VALUES (:item_id, :role, :path, :width, :height, 0, :now)'
    );

    foreach ($items as $i => [$slug, $title, $orientation]) {
        $insertItem->execute([
            'category_id' => $categoryIds[$slug],
            'title' => $title,
            'description' => null,
            'alt_text' => $title . ' — placeholder photo, replace before launch.',
            'featured' => $i < 3 ? 1 : 0,
            'order' => $i,
            'now' => $now,
        ]);
        $itemId = (int) $pdo->lastInsertId();

        [$w, $h] = match ($orientation) {
            'portrait' => [900, 1200],
            'landscape' => [1200, 800],
            default => [1000, 1000],
        };
        $path = PlaceholderImage::generate('gallery', $itemId . '_primary', $w, $h, $title, $slug);
        $insertMedia->execute(['item_id' => $itemId, 'role' => 'primary', 'path' => $path, 'width' => $w, 'height' => $h, 'now' => $now]);
    }

    // Two before/after transformation entries.
    $transformations = ['Fade Transformation', 'Long-to-Short Transformation'];
    foreach ($transformations as $i => $title) {
        $insertItem->execute([
            'category_id' => $categoryIds['transformations'],
            'title' => $title,
            'description' => null,
            'alt_text' => $title . ' — placeholder before and after photos, replace before launch.',
            'featured' => 1,
            'order' => count($items) + $i,
            'now' => $now,
        ]);
        $itemId = (int) $pdo->lastInsertId();

        $beforePath = PlaceholderImage::generate('gallery', $itemId . '_before', 900, 1200, $title . ' — Before', 'before');
        $afterPath = PlaceholderImage::generate('gallery', $itemId . '_after', 900, 1200, $title . ' — After', 'after');
        $insertMedia->execute(['item_id' => $itemId, 'role' => 'before', 'path' => $beforePath, 'width' => 900, 'height' => 1200, 'now' => $now]);
        $insertMedia->execute(['item_id' => $itemId, 'role' => 'after', 'path' => $afterPath, 'width' => 900, 'height' => 1200, 'now' => $now]);
    }

    echo (count($items) + count($transformations)) . " gallery item(s) seeded with generated placeholder images.\n";

    PlaceholderImage::generate('placeholders', 'hero-poster', 1600, 900, 'HyrumHaircuts — hero video placeholder', 'hero');
    PlaceholderImage::generate('placeholders', 'og-image', 1200, 630, 'HyrumHaircuts', 'og');
    PlaceholderImage::generate('placeholders', 'about-portrait', 1000, 1250, 'About Hyrum — placeholder portrait', 'about');
    echo "Hero poster, Open Graph, and About placeholder images generated.\n";
} else {
    echo "Gallery items already present, skipped.\n";
}

// ---------------------------------------------------------------------
// Reviews (clearly labeled as placeholders, never presented as real)
// ---------------------------------------------------------------------
$reviewCount = (int) $pdo->query('SELECT COUNT(*) FROM reviews')->fetchColumn();
if ($reviewCount === 0) {
    $reviews = [
        ['J.', '[Placeholder review] Walked in unsure what I wanted and walked out with the best fade I\'ve had. Replace with a real approved quote before launch.', 'Skin Fade'],
        ['M.', '[Placeholder review] Patient, precise, and easy to talk to. Replace with a real approved quote before launch.', 'Taper Fade'],
        ['A.', '[Placeholder review] My go-to for beard lineups now. Replace with a real approved quote before launch.', 'Beard Trim & Lineup'],
    ];
    $insertReview = $pdo->prepare(
        'INSERT INTO reviews (client_label, quote, haircut_type, is_approved, display_order, created_at, updated_at)
         VALUES (:label, :quote, :type, 1, :order, :now, :now)'
    );
    foreach ($reviews as $i => [$label, $quote, $type]) {
        $insertReview->execute(['label' => $label, 'quote' => $quote, 'type' => $type, 'order' => $i, 'now' => $now]);
    }
    echo count($reviews) . " placeholder review(s) seeded.\n";
} else {
    echo "Reviews already present, skipped.\n";
}

echo "Seeding complete.\n";
