# Wrexlyn for Investments — Copyright (c) 2026 Nishant Prabhakar. All rights reserved.
# Unauthorized copying, modification, or distribution is prohibited. See LICENSE for details.
#
# Polls the server port and only opens the browser once it's actually
# accepting connections, instead of guessing with a fixed delay.
param(
    [int]$Port = 4500,
    [int]$TimeoutSeconds = 30
)

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
while ((Get-Date) -lt $deadline) {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $client.Connect("127.0.0.1", $Port)
        if ($client.Connected) {
            $client.Close()
            Start-Process "http://localhost:$Port"
            exit 0
        }
    } catch {
        Start-Sleep -Milliseconds 400
    }
}
# Timed out: the server never came up. Say nothing here — the main console
# window already shows whatever error caused that.
