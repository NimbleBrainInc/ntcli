#!/bin/bash

set -e

ntcli config reset -f

ntcli domain set nt.dev --insecure

ntcli ws create dev1

ntcli server deploy ai.nimblebrain/echo
