<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Config;
use App\Core\Controller;
use App\Core\Csrf;
use App\Core\Mail;
use App\Core\RateLimiter;
use App\Core\Request;
use App\Core\Response;
use App\Core\Session;
use App\Core\SpamGuard;
use App\Core\Validator;
use App\Core\View;
use App\Repositories\BookingRepository;
use App\Repositories\ServiceRepository;
use App\Repositories\SettingsRepository;

final class BookingController extends Controller
{
    public function show(Request $request): void
    {
        $settings = (new SettingsRepository())->all();

        $this->render('booking.show', [
            'settings' => $settings,
            'services' => (new ServiceRepository())->active(),
            'calendlyUrl' => $settings['calendly_url'] ?: (string) Config::get('booking.calendly_url', ''),
            'timeWindows' => array_filter(explode('|', $settings['preferred_time_windows'] ?? '')),
            'seoTitle' => 'Book a Haircut — ' . ($settings['brand_name'] ?? config('app.name')),
            'seoDescription' => 'Request an appointment with Hyrum, or check live availability on the calendar.',
        ]);
    }

    public function store(Request $request): void
    {
        if (!Csrf::verify($request->input('_csrf'))) {
            Response::status(419);
            echo View::render('errors/419');
            return;
        }

        $ip = $request->ip();
        $rateKey = 'booking:' . $ip;
        $limits = Config::get('booking.rate_limit', []);

        if (RateLimiter::tooManyAttempts($rateKey, $limits['booking_max'] ?? 5, $limits['booking_window_minutes'] ?? 15)) {
            Response::status(429);
            echo View::render('errors/429');
            return;
        }

        // Spam defenses fail silently as a generic validation error rather
        // than revealing the honeypot/timing mechanism to a bot.
        if (SpamGuard::honeypotTripped($request) || !SpamGuard::timingValid($request)) {
            RateLimiter::hit($rateKey);
            Session::flash('booking_error', 'Your request could not be submitted. Please try again.');
            Response::redirect('/booking');
            return;
        }

        $rules = [
            'full_name' => 'required|max:120',
            'phone' => 'required|phone|max:30',
            'email' => 'required|email|max:190',
            'service_id' => 'nullable|integer',
            'preferred_date' => 'required|date|future_date',
            'preferred_time_slot' => 'required|max:80',
            'client_type' => 'required|in:first_time,returning',
            'notes' => 'nullable|max:1000',
            'consent' => 'accepted',
        ];

        $validator = Validator::make($request->all(), $rules);

        $serviceId = $request->input('service_id');
        if ($serviceId !== null && $serviceId !== '' && (new ServiceRepository())->find((int) $serviceId) === null) {
            $validator = Validator::make(array_merge($request->all(), ['service_id' => null]), $rules);
        }

        if ($validator->fails()) {
            RateLimiter::hit($rateKey);
            $this->withErrors($validator->errors(), $request->all());
            Response::redirect('/booking');
            return;
        }

        $data = $validator->validated();
        $data['request_ip'] = $ip;

        $booking = (new BookingRepository())->create($data);
        RateLimiter::hit($rateKey);

        $this->sendNotifications($booking, $data);

        Session::flash('booking_created', true);
        Response::redirect('/booking/manage/' . $booking['token']);
    }

    private function sendNotifications(array $booking, array $data): void
    {
        $manageUrl = url('/booking/manage/' . $booking['token']);

        Mail::send(
            $data['email'],
            'Your appointment request — ' . $booking['reference_code'],
            "Hi {$data['full_name']},\n\n" .
            "You're all set! Hyrum will personally confirm your exact time by text or email shortly.\n\n" .
            "Reference: {$booking['reference_code']}\n" .
            "Requested date: {$data['preferred_date']}\n" .
            "Preferred window: {$data['preferred_time_slot']}\n\n" .
            "View or cancel this request: {$manageUrl}\n"
        );

        $ownerAddress = (string) Config::get('mail.owner_address', '');
        if ($ownerAddress !== '') {
            Mail::send(
                $ownerAddress,
                'New appointment request — ' . $booking['reference_code'],
                "New request from {$data['full_name']} ({$data['phone']}, {$data['email']})\n" .
                "Date: {$data['preferred_date']} — {$data['preferred_time_slot']}\n" .
                "Client type: {$data['client_type']}\n" .
                "Notes: " . ($data['notes'] ?? '(none)') . "\n\n" .
                "Manage in the admin dashboard: " . url('/admin/bookings') . "\n"
            );
        }
    }

    public function manage(Request $request): void
    {
        $token = (string) $request->param('token');
        $booking = (new BookingRepository())->findByToken($token);

        if ($booking === null) {
            Response::status(404);
            echo View::render('errors/404');
            return;
        }

        $service = $booking['service_id'] ? (new ServiceRepository())->find((int) $booking['service_id']) : null;

        $this->render('booking.manage', [
            'booking' => $booking,
            'service' => $service,
            'token' => $token,
            'justCreated' => (bool) Session::getFlash('booking_created', false),
            'seoTitle' => 'Your appointment request',
        ]);
    }

    public function cancel(Request $request): void
    {
        if (!Csrf::verify($request->input('_csrf'))) {
            Response::status(419);
            echo View::render('errors/419');
            return;
        }

        $token = (string) $request->param('token');
        $repository = new BookingRepository();
        $booking = $repository->findByToken($token);

        if ($booking === null) {
            Response::status(404);
            echo View::render('errors/404');
            return;
        }

        if (in_array($booking['status'], ['pending', 'confirmed'], true)) {
            $repository->updateStatus((int) $booking['id'], 'cancelled', null, 'Cancelled by client via manage link.');
            Session::flash('notice', 'Your appointment request has been cancelled.');
        }

        Response::redirect('/booking/manage/' . $token);
    }
}
