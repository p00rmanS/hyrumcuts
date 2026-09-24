<?php

declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Controller;
use App\Core\Request;
use App\Repositories\AuditLogRepository;
use App\Repositories\BookingRepository;

final class DashboardController extends Controller
{
    public function index(Request $request): void
    {
        $this->requireAdmin();

        $bookingRepo = new BookingRepository();

        $this->render('admin.dashboard', [
            'pageTitle' => 'Dashboard',
            'counts' => $bookingRepo->counts(),
            'recentBookings' => $bookingRepo->paginated(null, 1, 8)['items'],
            'recentActivity' => (new AuditLogRepository())->recent(10),
        ], 'layouts/admin');
    }
}
