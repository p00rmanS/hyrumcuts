<?php

declare(strict_types=1);

use App\Core\Config;
use App\Core\Database;

$config = require dirname(__DIR__) . '/config/bootstrap.php';
Config::set($config);

function prompt(string $label, bool $hidden = false): string
{
    fwrite(STDOUT, $label);
    if ($hidden && stripos(PHP_OS, 'WIN') !== 0) {
        system('stty -echo');
        $value = trim((string) fgets(STDIN));
        system('stty echo');
        fwrite(STDOUT, "\n");
        return $value;
    }
    return trim((string) fgets(STDIN));
}

$args = getopt('', ['name:', 'email:', 'password:']);

$name = $args['name'] ?? prompt('Admin name: ');
$email = $args['email'] ?? prompt('Admin email: ');
$password = $args['password'] ?? prompt('Admin password (min 10 characters): ', true);

if ($name === '' || $email === '' || $password === '') {
    fwrite(STDERR, "Name, email, and password are all required.\n");
    exit(1);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fwrite(STDERR, "That email address doesn't look valid.\n");
    exit(1);
}

if (strlen($password) < 10) {
    fwrite(STDERR, "Password must be at least 10 characters.\n");
    exit(1);
}

$pdo = Database::connection();

$existing = $pdo->prepare('SELECT id FROM admins WHERE email = :email');
$existing->execute(['email' => $email]);
if ($existing->fetch() !== false) {
    fwrite(STDERR, "An admin with that email already exists.\n");
    exit(1);
}

$stmt = $pdo->prepare(
    'INSERT INTO admins (name, email, password_hash, created_at, updated_at)
     VALUES (:name, :email, :hash, :now, :now)'
);
$stmt->execute([
    'name' => $name,
    'email' => $email,
    'hash' => password_hash($password, PASSWORD_DEFAULT),
    'now' => gmdate('Y-m-d H:i:s'),
]);

echo "Admin account created for {$email}. You can now log in at /admin/login.\n";
