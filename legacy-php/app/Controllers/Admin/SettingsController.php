<?php

declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Auth;
use App\Core\Controller;
use App\Core\Request;
use App\Core\Response;
use App\Core\Session;
use App\Repositories\AuditLogRepository;
use App\Repositories\SettingsRepository;

final class SettingsController extends Controller
{
    /** Keys editable from the settings screen, with their max lengths. */
    private const FIELDS = [
        'brand_name' => 120,
        'barber_name' => 120,
        'hero_eyebrow' => 120,
        'hero_heading' => 160,
        'hero_subheading' => 220,
        'about_bio' => 2000,
        'about_specialties' => 200,
        'about_location' => 160,
        'about_availability_note' => 200,
        'about_contact_method' => 120,
        'instagram_url' => 300,
        'facebook_url' => 300,
        'phone' => 40,
        'email' => 190,
        'location_general' => 160,
        'timezone' => 60,
        'booking_policy' => 1000,
        'faq_book' => 500,
        'faq_confirmed' => 500,
        'faq_reference' => 500,
        'faq_reschedule' => 500,
        'faq_confirmation' => 500,
        'seo_title' => 160,
        'seo_description' => 300,
        'calendly_url' => 300,
        'map_url' => 300,
        'address_full' => 300,
        'credit_text' => 160,
        'privacy_contact_email' => 190,
        'analytics_provider' => 40,
        'analytics_site_id' => 100,
        'preferred_time_windows' => 400,
    ];

    public function index(Request $request): void
    {
        $this->requireAdmin();

        $this->render('admin.settings.index', [
            'pageTitle' => 'Settings',
            'settings' => (new SettingsRepository())->all(),
        ], 'layouts/admin');
    }

    public function update(Request $request): void
    {
        $this->requireAdmin();
        $this->verifyCsrfOrFail($request);

        $values = [];
        foreach (array_keys(self::FIELDS) as $key) {
            $maxLength = self::FIELDS[$key];
            $value = trim((string) $request->input($key, ''));
            $values[$key] = mb_substr($value, 0, $maxLength);
        }

        if ($values['email'] !== '' && !filter_var($values['email'], FILTER_VALIDATE_EMAIL)) {
            Session::flash('admin_error', 'Enter a valid contact email, or leave it blank.');
            Response::redirect('/admin/settings');
            return;
        }

        (new SettingsRepository())->setMany($values);
        (new AuditLogRepository())->log(Auth::id(), 'settings.updated');

        Session::flash('notice', 'Settings saved.');
        Response::redirect('/admin/settings');
    }
}
