#Requires -Version 5.1
<#
.SYNOPSIS
  Alias : demarre le backend GDRI en mode test.
  Equivalent a : .\Start-Backend.ps1 -Mode Test
#>
[CmdletBinding()]
param(
    [switch]$Dev,
    [switch]$SkipChecks,
    [switch]$SkipCloneHint
)

& "$PSScriptRoot\Start-Backend.ps1" -Mode Test -Dev:$Dev -SkipChecks:$SkipChecks -SkipCloneHint:$SkipCloneHint
