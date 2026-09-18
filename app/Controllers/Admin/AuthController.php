<?php

declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Auth;
use App\Core\Config;
use App\Core\Controller;
use App\Core\Csrf;
use App\Core\RateLimiter;
use App\Core\Request;
use App\Core\Response;
use App\Core\Session;
use App\Repositories\AuditLogRepository;

final class AuthController extends Controller
{
    public function showLogin(Request $request): void
    {
        if (Auth::check()) {
            Response::redirect('/admin');
        }

        $this->render('admin.auth.login', [
            'notice' => Session::getFlash('notice'),
            'loginError' => Session::getFlash('login_error'),
        ], 'layouts/admin-guest');
    }

    public function login(Request $request): void
    {
        $this->verifyCsrfOrFail($request);

        $ip = $request->ip();
        $rateKey = 'admin_login:' . $ip;
        $limits = Config::get('booking.rate_limit', []);

        if (RateLimiter::tooManyAttempts($rateKey, $limits['login_max'] ?? 5, $limits['login_window_minutes'] ?? 15)) {
            Response::status(429);
            echo \App\Core\View::render('errors/429');
            return;
        }

        RateLimiter::hit($rateKey);

        $email = trim((string) $request->input('email', ''));
        $password = (string) $request->input('password', '');

        if ($email === '' || $password === '' || !Auth::attempt($email, $password)) {
            // Deliberately generic: never reveal whether the account exists.
            Session::flash('login_error', 'Those credentials are not correct.');
            Response::redirect('/admin/login');
        }

        (new AuditLogRepository())->log(Auth::id(), 'admin.login');

        Response::redirect('/admin');
    }

    public function logout(Request $request): void
    {
        $this->verifyCsrfOrFail($request);

        (new AuditLogRepository())->log(Auth::id(), 'admin.logout');
        Auth::logout();
        Response::redirect('/admin/login');
    }
}
