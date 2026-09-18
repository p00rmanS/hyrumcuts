<?php

declare(strict_types=1);

use App\Core\Env;

return [
    // Scheduling is delegated to Calendly (or a Google Calendar Appointment
    // Schedule, which produces an equivalent public booking URL). The site
    // does not run its own slot/availability engine. If this is blank, the
    // live scheduler is hidden and only the request-only form is shown.
    'calendly_url' => Env::get('CALENDLY_URL', ''),

    'rate_limit' => [
        'booking_max' => (int) Env::get('RATE_LIMIT_BOOKING_MAX', 5),
        'booking_window_minutes' => (int) Env::get('RATE_LIMIT_BOOKING_WINDOW_MINUTES', 15),
        'login_max' => (int) Env::get('RATE_LIMIT_LOGIN_MAX', 5),
        'login_window_minutes' => (int) Env::get('RATE_LIMIT_LOGIN_WINDOW_MINUTES', 15),
    ],
];
