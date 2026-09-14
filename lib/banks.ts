export type Bank = {
  key: string
  name: string
  nameAr: string
  account: string
  iban: string
  holder: string
  reason: string
}

export const BANKS: Bank[] = [
  {
    key: "alrajhi",
    name: "Al Rajhi Bank",
    nameAr: "مصرف الراجحي",
    account: "640000010006086788446",
    iban: "SA3680000640608016788446",
    holder: "Naif Ali Faqiri",
    reason: "Personal Transfer",
  },
  {
    key: "stc",
    name: "STC Bank",
    nameAr: "بنك STC",
    account: "1116807878",
    iban: "SA2778000000001116807878",
    holder: "Naif Ali Mohammed Faqiri",
    reason: "Personal Transfer",
  },
  {
    key: "d360",
    name: "D360 Bank",
    nameAr: "بنك D360",
    account: "DBAKSARIXXX",
    iban: "SA6436036036001591753480",
    holder: "Naif Ali Mohammed Faqiri",
    reason: "Personal Transfer",
  },
  {
    key: "alinma",
    name: "Alinma Bank",
    nameAr: "مصرف الإنماء",
    account: "68206112797001",
    iban: "SA8805000068206112797001",
    holder: "Naif Ali Faqiri",
    reason: "Personal Transfer",
  },
  {
    key: "anb",
    name: "ANB Bank",
    nameAr: "البنك العربي الوطني",
    account: "0108037494100016",
    iban: "SA1930400108037494100016",
    holder: "Naif Ali Faqiri",
    reason: "Personal Transfer",
  },
]

export function getBank(key: string | null | undefined): Bank | undefined {
  if (!key) return undefined
  return BANKS.find((b) => b.key === key)
}

export function randomBank(): Bank {
  return BANKS[Math.floor(Math.random() * BANKS.length)]
}
