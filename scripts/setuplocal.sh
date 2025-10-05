#!/bin/bash


ntcli config reset -f

ntcli domain set nt.dev --insecure

ntcli ws create foobar

ntcli token create

ntcli reg create https://raw.githubusercontent.com/NimbleBrainInc/nimbletools-mcp-registry/main/registry.yaml

ntcli server deploy echo

