export default defineEventHandler(async (event) => {
  return {
    message: 'Hello World!',
    userName: "John Doe"
  }
})