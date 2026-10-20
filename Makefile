SEA ?= $(shell command -v sea 2>/dev/null || ([ -x ../sea/bin/sea ] && echo ../sea/bin/sea) || echo $(HOME)/projects/sea_vm/bin/sea)
SEA_PATH ?= $(shell [ -d ../sea/libs ] && echo ../sea/libs || echo $(HOME)/projects/sea_vm/libs)
export SEA_PATH

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
