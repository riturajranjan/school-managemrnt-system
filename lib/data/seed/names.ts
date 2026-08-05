export const firstNamesMale = [
  "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Reyansh", "Ayaan", "Krishna",
  "Ishaan", "Kabir", "Rohan", "Aryan", "Dhruv", "Kian", "Advik", "Yash",
] as const;

export const firstNamesFemale = [
  "Ananya", "Diya", "Saanvi", "Aadhya", "Myra", "Anika", "Ira", "Kiara",
  "Riya", "Navya", "Zara", "Aarohi", "Pihu", "Sara", "Meera", "Anaya",
] as const;

export const lastNames = [
  "Sharma", "Verma", "Gupta", "Kumar", "Singh", "Patel", "Reddy", "Iyer",
  "Nair", "Menon", "Rao", "Malhotra", "Kapoor", "Chatterjee", "Bose", "Joshi",
  "Desai", "Mehta", "Agarwal", "Bhatt",
] as const;

export const occupations = [
  "Software Engineer", "Doctor", "Business Owner", "Government Officer", "Teacher",
  "Chartered Accountant", "Architect", "Lawyer", "Consultant", "Bank Manager",
] as const;

export const organizations = [
  "Infosys", "TCS", "Apollo Hospitals", "State Bank of India", "Self-employed",
  "HDFC Bank", "Wipro", "Reliance Industries", "Deloitte", "Freelance",
] as const;

export const cities = [
  { city: "Bengaluru", state: "Karnataka" },
  { city: "Mumbai", state: "Maharashtra" },
  { city: "Pune", state: "Maharashtra" },
  { city: "Hyderabad", state: "Telangana" },
  { city: "Chennai", state: "Tamil Nadu" },
  { city: "Delhi", state: "Delhi" },
] as const;

export const staffNames = [
  "Meera Krishnan", "Anil Deshpande", "Farah Sheikh", "Vikram Oberoi", "Priya Ramesh",
  "Suresh Pillai", "Kavita Nambiar", "Rajesh Khurana",
] as const;

export function fullName(first: string, last: string) {
  return `${first} ${last}`;
}
