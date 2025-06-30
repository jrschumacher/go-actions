// Package main demonstrates a simple Go application that shows
// the go-actions CI/CD capabilities including testing, linting, and benchmarking.
package main

import (
	"fmt"
	"math"
	"strconv"
	"strings"
)

func main() {
	fmt.Println("🔢 Go Actions Example Calculator")
	fmt.Println("=================================")

	// Demonstrate basic arithmetic
	a, b := 10, 5
	fmt.Printf("Add(%d, %d) = %d\n", a, b, Add(a, b))
	fmt.Printf("Subtract(%d, %d) = %d\n", a, b, Subtract(a, b))
	fmt.Printf("Multiply(%d, %d) = %d\n", a, b, Multiply(a, b))
	fmt.Printf("Divide(%d, %d) = %.2f\n", a, b, Divide(float64(a), float64(b)))

	// Demonstrate string operations
	words := []string{"Go", "Actions", "Example"}
	fmt.Printf("JoinStrings(%v) = %q\n", words, JoinStrings(words, "-"))
	fmt.Printf("ReverseString(%q) = %q\n", "hello", ReverseString("hello"))

	// Demonstrate math operations
	x := 16.0
	fmt.Printf("Sqrt(%.1f) = %.2f\n", x, Sqrt(x))
	fmt.Printf("Power(2, 3) = %.0f\n", Power(2, 3))

	// Demonstrate validation
	email := "test@example.com"
	fmt.Printf("IsValidEmail(%q) = %t\n", email, IsValidEmail(email))
}

// Add returns the sum of two integers.
func Add(a, b int) int {
	return a + b
}

// Subtract returns the difference of two integers.
func Subtract(a, b int) int {
	return a - b
}

// Multiply returns the product of two integers.
func Multiply(a, b int) int {
	return a * b
}

// Divide returns the quotient of two floating-point numbers.
// It returns 0 if the divisor is zero.
func Divide(a, b float64) float64 {
	if b == 0 {
		return 0
	}
	return a / b
}

// JoinStrings concatenates a slice of strings with a separator.
func JoinStrings(words []string, separator string) string {
	return strings.Join(words, separator)
}

// ReverseString returns the reverse of the input string.
func ReverseString(s string) string {
	runes := []rune(s)
	for i, j := 0, len(runes)-1; i < j; i, j = i+1, j-1 {
		runes[i], runes[j] = runes[j], runes[i]
	}
	return string(runes)
}

// Sqrt returns the square root of a number.
func Sqrt(x float64) float64 {
	return math.Sqrt(x)
}

// Power returns base raised to the power of exponent.
func Power(base, exponent float64) float64 {
	return math.Pow(base, exponent)
}

// IsValidEmail performs basic email validation.
func IsValidEmail(email string) bool {
	return strings.Contains(email, "@") && strings.Contains(email, ".")
}

// Fibonacci returns the nth Fibonacci number.
func Fibonacci(n int) int {
	if n <= 1 {
		return n
	}
	return Fibonacci(n-1) + Fibonacci(n-2)
}

// IsPrime checks if a number is prime.
func IsPrime(n int) bool {
	if n < 2 {
		return false
	}
	for i := 2; i*i <= n; i++ {
		if n%i == 0 {
			return false
		}
	}
	return true
}

// ParseAndSum parses comma-separated numbers and returns their sum.
func ParseAndSum(input string) (int, error) {
	parts := strings.Split(input, ",")
	sum := 0
	for _, part := range parts {
		num, err := strconv.Atoi(strings.TrimSpace(part))
		if err != nil {
			return 0, fmt.Errorf("invalid number: %s", part)
		}
		sum += num
	}
	return sum, nil
}