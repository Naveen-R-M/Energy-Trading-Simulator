"use client"

import { useState, useEffect } from "react"

export function useTheme() {
  const [isDarkMode, setIsDarkMode] = useState(false)

  useEffect(() => {
    // Check for saved theme preference or default to light mode
    const savedTheme = localStorage.getItem("theme")
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    
    const shouldBeDark = savedTheme === "dark" || (!savedTheme && prefersDark)
    
    setIsDarkMode(shouldBeDark)
    document.documentElement.classList.toggle("dark", shouldBeDark)
  }, [])

  const toggleTheme = () => {
    const newDarkMode = !isDarkMode
    setIsDarkMode(newDarkMode)
    
    // Save preference
    localStorage.setItem("theme", newDarkMode ? "dark" : "light")
    
    // Apply theme
    document.documentElement.classList.toggle("dark", newDarkMode)
  }

  return {
    isDarkMode,
    toggleTheme,
  }
}
