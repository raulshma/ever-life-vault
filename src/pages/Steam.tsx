// This file now acts as a thin redirect so existing imports keep working during refactor
import React from 'react'
import SteamStandalone from './steam/SteamStandalone'

export default function Steam() {
  return <SteamStandalone />
}
