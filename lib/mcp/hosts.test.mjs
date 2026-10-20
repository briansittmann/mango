import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hostKind } from './hosts.ts'

test('claude.ai, chatgpt.com and their subdomains are known', () => {
  for (const host of ['claude.ai', 'api.claude.ai', 'chatgpt.com', 'CHATGPT.COM']) assert.equal(hostKind(host), 'known', host)
})

test('this computer is local, with or without a port', () => {
  for (const host of ['localhost', 'localhost:53682', '127.0.0.1', '127.0.0.1:8080', '[::1]', '[::1]:3000']) assert.equal(hostKind(host), 'local', host)
})

test('look-alikes and anything else are unknown', () => {
  for (const host of ['claude-ai.example.com', 'evilclaude.ai', 'claude.ai.example.com', 'chatgpt.com.evil.io', 'example.com', '']) {
    assert.equal(hostKind(host), 'unknown', host)
  }
})
