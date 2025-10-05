#!/bin/bash

set -e

ntcli config reset -f

ntcli auth login

ntcli domain set nt.ent:8081 --insecure

ntcli ws create ent1

ntcli server deploy ai.nimblebrain/echo
