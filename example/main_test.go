package main

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestAdd(t *testing.T) {
	tests := []struct {
		name     string
		a, b     int
		expected int
	}{
		{"positive numbers", 2, 3, 5},
		{"negative numbers", -2, -3, -5},
		{"mixed numbers", -2, 3, 1},
		{"zero", 0, 5, 5},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := Add(tt.a, tt.b)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestSubtract(t *testing.T) {
	tests := []struct {
		name     string
		a, b     int
		expected int
	}{
		{"positive numbers", 5, 3, 2},
		{"negative numbers", -5, -3, -2},
		{"mixed numbers", 5, -3, 8},
		{"zero", 5, 0, 5},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := Subtract(tt.a, tt.b)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestMultiply(t *testing.T) {
	tests := []struct {
		name     string
		a, b     int
		expected int
	}{
		{"positive numbers", 3, 4, 12},
		{"negative numbers", -3, -4, 12},
		{"mixed numbers", -3, 4, -12},
		{"zero", 0, 5, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := Multiply(tt.a, tt.b)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestDivide(t *testing.T) {
	tests := []struct {
		name     string
		a, b     float64
		expected float64
	}{
		{"normal division", 10.0, 2.0, 5.0},
		{"division by zero", 10.0, 0.0, 0.0},
		{"negative numbers", -10.0, 2.0, -5.0},
		{"decimal result", 7.0, 2.0, 3.5},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := Divide(tt.a, tt.b)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestJoinStrings(t *testing.T) {
	tests := []struct {
		name      string
		words     []string
		separator string
		expected  string
	}{
		{"simple words", []string{"hello", "world"}, " ", "hello world"},
		{"hyphen separator", []string{"go", "actions"}, "-", "go-actions"},
		{"empty words", []string{}, "-", ""},
		{"single word", []string{"test"}, "-", "test"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := JoinStrings(tt.words, tt.separator)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestReverseString(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"simple word", "hello", "olleh"},
		{"palindrome", "racecar", "racecar"},
		{"empty string", "", ""},
		{"single char", "a", "a"},
		{"numbers", "12345", "54321"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ReverseString(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestSqrt(t *testing.T) {
	tests := []struct {
		name     string
		input    float64
		expected float64
	}{
		{"perfect square", 16.0, 4.0},
		{"zero", 0.0, 0.0},
		{"decimal", 2.25, 1.5},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := Sqrt(tt.input)
			assert.InDelta(t, tt.expected, result, 0.0001)
		})
	}
}

func TestPower(t *testing.T) {
	tests := []struct {
		name     string
		base     float64
		exponent float64
		expected float64
	}{
		{"square", 2.0, 2.0, 4.0},
		{"cube", 3.0, 3.0, 27.0},
		{"power of zero", 5.0, 0.0, 1.0},
		{"zero base", 0.0, 5.0, 0.0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := Power(tt.base, tt.exponent)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestIsValidEmail(t *testing.T) {
	tests := []struct {
		name     string
		email    string
		expected bool
	}{
		{"valid email", "test@example.com", true},
		{"missing @", "testexample.com", false},
		{"missing domain", "test@", false},
		{"missing dot", "test@example", false},
		{"empty string", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsValidEmail(tt.email)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestFibonacci(t *testing.T) {
	tests := []struct {
		name     string
		n        int
		expected int
	}{
		{"fibonacci 0", 0, 0},
		{"fibonacci 1", 1, 1},
		{"fibonacci 5", 5, 5},
		{"fibonacci 8", 8, 21},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := Fibonacci(tt.n)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestIsPrime(t *testing.T) {
	tests := []struct {
		name     string
		n        int
		expected bool
	}{
		{"prime 2", 2, true},
		{"prime 3", 3, true},
		{"prime 7", 7, true},
		{"composite 4", 4, false},
		{"composite 9", 9, false},
		{"negative", -1, false},
		{"zero", 0, false},
		{"one", 1, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsPrime(tt.n)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestParseAndSum(t *testing.T) {
	tests := []struct {
		name      string
		input     string
		expected  int
		expectErr bool
	}{
		{"valid numbers", "1,2,3,4", 10, false},
		{"single number", "42", 42, false},
		{"with spaces", "1, 2, 3", 6, false},
		{"invalid number", "1,abc,3", 0, true},
		{"empty string", "", 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ParseAndSum(tt.input)
			if tt.expectErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expected, result)
			}
		})
	}
}

// Benchmark tests
func BenchmarkAdd(b *testing.B) {
	for i := 0; i < b.N; i++ {
		Add(100, 200)
	}
}

func BenchmarkMultiply(b *testing.B) {
	for i := 0; i < b.N; i++ {
		Multiply(100, 200)
	}
}

func BenchmarkReverseString(b *testing.B) {
	s := "abcdefghijklmnopqrstuvwxyz"
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ReverseString(s)
	}
}

func BenchmarkFibonacci(b *testing.B) {
	for i := 0; i < b.N; i++ {
		Fibonacci(10)
	}
}

func BenchmarkIsPrime(b *testing.B) {
	for i := 0; i < b.N; i++ {
		IsPrime(97)
	}
}

func BenchmarkSqrt(b *testing.B) {
	for i := 0; i < b.N; i++ {
		Sqrt(123.456)
	}
}

func BenchmarkParseAndSum(b *testing.B) {
	input := "1,2,3,4,5,6,7,8,9,10"
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ParseAndSum(input)
	}
}