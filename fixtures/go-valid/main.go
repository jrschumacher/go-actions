package main

import "fmt"

func main() {
	fmt.Printf("Sum: %d\n", Add(2, 3))
}

// Add returns the sum of two integers.
func Add(a, b int) int {
	return a + b
}

// Multiply returns the product of two integers.
func Multiply(a, b int) int {
	return a * b
}