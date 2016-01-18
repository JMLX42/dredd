#!/usr/bin/env ruby

require './deployment/autoconfigure.rb'

VERBOSE = false

Vagrant.autoconfigure({
  "local" => {
    "hosts" => ["192.168.50.43"],
    "vars" => {
      "hostname" => "dredd.fr.test"
    },
    "memory" => 2048,
    "skip_tags" => []
  }
})
