<?php

declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Auth;
use App\Core\Controller;
use App\Core\Request;
use App\Core\Response;
use App\Core\Session;
use App\Repositories\AuditLogRepository;
use App\Repositories\BookingRepository;
use App\Repositories\ServiceRepository;

final class BookingController extends Controller
{
    private const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];

    public function index(Request $request): void
    {
        $this->requireAdmin();

        $status = $request->input('status');
        $status = in_array($status, self::STATUSES, true) ? $status : null;
        $page = max(1, (int) $request->input('page', 1));

        $repo = new BookingRepository();
        $result = $repo->paginated($status, $page, 20);

        $this->render('admin.bookings.index', [
            'pageTitle' => 'Bookings',
            'bookings' => $result['items'],
            'total' => $result['total'],
            'page' => $page,
            'perPage' => 20,
            'status' => $status,
            'statuses' => self::STATUSES,
        ], 'layouts/admin');
    }

    public function show(Request $request): void
    {
        $this->requireAdmin();

        $id = (int) $request->param('id');
        $repo = new BookingRepository();
        $booking = $repo->find($id);

        if ($booking === null) {
            Response::status(404);
            echo \App\Core\View::render('errors/404', [], 'layouts/admin');
            return;
        }

        $service = $booking['service_id'] ? (new ServiceRepository())->find((int) $booking['service_id']) : null;

        $this->render('admin.bookings.show', [
            'pageTitle' => 'Booking ' . $booking['reference_code'],
            'booking' => $booking,
            'service' => $service,
            'history' => $repo->history($id),
            'statuses' => self::STATUSES,
        ], 'layouts/admin');
    }

    public function updateStatus(Request $request): void
    {
        $this->requireAdmin();
        $this->verifyCsrfOrFail($request);

        $id = (int) $request->param('id');
        $status = (string) $request->input('status');

        if (!in_array($status, self::STATUSES, true)) {
            Session::flash('admin_error', 'That is not a valid status.');
            Response::redirect('/admin/bookings/' . $id);
            return;
        }

        $repo = new BookingRepository();
        if ($repo->find($id) === null) {
            Response::status(404);
            echo \App\Core\View::render('errors/404', [], 'layouts/admin');
            return;
        }

        $repo->updateStatus($id, $status, Auth::id());
        (new AuditLogRepository())->log(Auth::id(), 'booking.status_updated', 'booking', $id, "New status: {$status}");

        Session::flash('notice', 'Booking status updated.');
        Response::redirect('/admin/bookings/' . $id);
    }

    public function updateNotes(Request $request): void
    {
        $this->requireAdmin();
        $this->verifyCsrfOrFail($request);

        $id = (int) $request->param('id');
        $repo = new BookingRepository();
        if ($repo->find($id) === null) {
            Response::status(404);
            echo \App\Core\View::render('errors/404', [], 'layouts/admin');
            return;
        }

        $notes = trim((string) $request->input('admin_notes', ''));
        $repo->updateAdminNotes($id, mb_substr($notes, 0, 2000));
        (new AuditLogRepository())->log(Auth::id(), 'booking.notes_updated', 'booking', $id);

        Session::flash('notice', 'Internal notes saved.');
        Response::redirect('/admin/bookings/' . $id);
    }
}
