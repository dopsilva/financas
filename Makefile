SEA ?= $(HOME)/projects/sea_vm/bin/sea
PORT ?= 8080
DB ?= financas.db

.PHONY: run test check fmt

run:
	$(SEA) main.sea -port $(PORT) -db $(DB)

test:
	$(SEA) test -v .

check:
	$(SEA) check *.sea

fmt:
	$(SEA) fmt *.sea
