<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Small allowlist-style validator. Rules are pipe-separated strings, e.g.
 * "required|email|max:255". Intentionally minimal: this project has under
 * a dozen forms, so a full validation library would be dead weight.
 */
final class Validator
{
    private array $errors = [];

    public function __construct(private readonly array $data, private readonly array $rules)
    {
    }

    public static function make(array $data, array $rules): self
    {
        $validator = new self($data, $rules);
        $validator->run();
        return $validator;
    }

    public function fails(): bool
    {
        return $this->errors !== [];
    }

    public function errors(): array
    {
        return $this->errors;
    }

    public function validated(): array
    {
        $out = [];
        foreach (array_keys($this->rules) as $field) {
            if (array_key_exists($field, $this->data)) {
                $out[$field] = is_string($this->data[$field]) ? trim($this->data[$field]) : $this->data[$field];
            }
        }
        return $out;
    }

    private function run(): void
    {
        foreach ($this->rules as $field => $ruleString) {
            $rules = explode('|', $ruleString);
            $value = $this->data[$field] ?? null;
            $value = is_string($value) ? trim($value) : $value;
            $label = ucfirst(str_replace('_', ' ', $field));

            foreach ($rules as $rule) {
                [$name, $param] = array_pad(explode(':', $rule, 2), 2, null);

                if (isset($this->errors[$field])) {
                    break;
                }

                match ($name) {
                    'required' => $this->checkRequired($field, $value, $label),
                    'nullable' => null,
                    'email' => $this->checkEmail($field, $value, $label),
                    'max' => $this->checkMax($field, $value, (int) $param, $label),
                    'min' => $this->checkMin($field, $value, (int) $param, $label),
                    'in' => $this->checkIn($field, $value, explode(',', (string) $param), $label),
                    'date' => $this->checkDate($field, $value, $label),
                    'future_date' => $this->checkFutureDate($field, $value, $label),
                    'phone' => $this->checkPhone($field, $value, $label),
                    'accepted' => $this->checkAccepted($field, $value, $label),
                    'integer' => $this->checkInteger($field, $value, $label),
                    default => null,
                };
            }
        }
    }

    private function fail(string $field, string $message): void
    {
        $this->errors[$field] = $message;
    }

    private function isBlank(mixed $value): bool
    {
        return $value === null || $value === '';
    }

    private function checkRequired(string $field, mixed $value, string $label): void
    {
        if ($this->isBlank($value)) {
            $this->fail($field, "{$label} is required.");
        }
    }

    private function checkEmail(string $field, mixed $value, string $label): void
    {
        if ($this->isBlank($value)) {
            return;
        }
        if (!is_string($value) || !filter_var($value, FILTER_VALIDATE_EMAIL)) {
            $this->fail($field, "Enter a valid email address.");
        }
    }

    private function checkMax(string $field, mixed $value, int $max, string $label): void
    {
        if (is_string($value) && mb_strlen($value) > $max) {
            $this->fail($field, "{$label} must be {$max} characters or fewer.");
        }
    }

    private function checkMin(string $field, mixed $value, int $min, string $label): void
    {
        if (is_string($value) && $value !== '' && mb_strlen($value) < $min) {
            $this->fail($field, "{$label} must be at least {$min} characters.");
        }
    }

    private function checkIn(string $field, mixed $value, array $allowed, string $label): void
    {
        if ($this->isBlank($value)) {
            return;
        }
        if (!in_array((string) $value, $allowed, true)) {
            $this->fail($field, "{$label} is not a valid choice.");
        }
    }

    private function checkDate(string $field, mixed $value, string $label): void
    {
        if ($this->isBlank($value)) {
            return;
        }
        $d = \DateTime::createFromFormat('Y-m-d', (string) $value);
        if (!$d || $d->format('Y-m-d') !== $value) {
            $this->fail($field, "Enter a valid date for {$label}.");
        }
    }

    private function checkFutureDate(string $field, mixed $value, string $label): void
    {
        if ($this->isBlank($value)) {
            return;
        }
        $d = \DateTime::createFromFormat('Y-m-d', (string) $value);
        $today = new \DateTime('today');
        if (!$d || $d < $today) {
            $this->fail($field, "{$label} must be a date in the future.");
        }
    }

    private function checkPhone(string $field, mixed $value, string $label): void
    {
        if ($this->isBlank($value)) {
            return;
        }
        $digits = preg_replace('/\D+/', '', (string) $value);
        if ($digits === null || strlen($digits) < 7 || strlen($digits) > 15) {
            $this->fail($field, "Enter a valid phone number.");
        }
    }

    private function checkAccepted(string $field, mixed $value, string $label): void
    {
        if (!in_array($value, ['1', 1, 'on', 'yes', true], true)) {
            $this->fail($field, "You must agree before continuing.");
        }
    }

    private function checkInteger(string $field, mixed $value, string $label): void
    {
        if ($this->isBlank($value)) {
            return;
        }
        if (filter_var($value, FILTER_VALIDATE_INT) === false) {
            $this->fail($field, "{$label} must be a whole number.");
        }
    }
}
