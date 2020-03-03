/**
 * Compile with:
 * emcc generate.c -o generate.js -s SINGLE_FILE=1
 * 
 */
#include <stdio.h>
#include <stddef.h>
#include <termios.h>
#include <sys/ioctl.h>

#define type_name(expr) \
  (_Generic((expr), \
    char: "char", unsigned char: "unsigned char", signed char: "signed char", \
    char*: "char*", unsigned char*: "unsigned char*", signed char*: "signed char*", \
    char**: "char**", unsigned char**: "unsigned char**", signed char**: "signed char**", \
    short: "short", unsigned short: "unsigned short", \
    short*: "short*", unsigned short*: "unsigned short*", \
    short**: "short**", unsigned short**: "unsigned short**", \
    int: "int", unsigned int: "unsigned int", \
    int*: "int*", unsigned int*: "unsigned int*", \
    int**: "int**", unsigned int**: "unsigned int**", \
    long: "long", unsigned long: "unsigned long", \
    long*: "long*", unsigned long*: "unsigned long*", \
    long**: "long**", unsigned long**: "unsigned long**", \
    long long: "long long", unsigned long long: "unsigned long long", \
    long long*: "long long*", unsigned long long*: "unsigned long long*", \
    long long**: "long long**", unsigned long long**: "unsigned long long**", \
    float: "float", double: "double", long double: "long double", \
    float*: "float*", double*: "double*", long double*: "long double*", \
    float**: "float**", double**: "double**", long double**: "long double**", \
    void*: "void*", \
    default: "?"))


#define EX(type, field) \
  printf("    " #field " : {offset: %lu, size: %lu, type: '%s'},\n", \
  offsetof(type, field), sizeof( ((type *)0)->field ), type_name( ((type *)0)->field ) );


#define STRUCT_SHAPE(name, type, fields)  \
  printf("S[" #name "] = {\n");           \
  printf("  type: '" #type "'\n");        \
  printf("  size: %lu,\n", sizeof(type)); \
  printf("  members: {\n");               \
  fields                                  \
  printf("  }\n");                        \
  printf("};\n");

#define INTRO() printf("const S = Object.create(null);\n");



#define STRINGIZE(arg)  STRINGIZE1(arg)
#define STRINGIZE1(arg) STRINGIZE2(arg)
#define STRINGIZE2(arg) #arg

#define CONCATENATE(arg1, arg2)   CONCATENATE1(arg1, arg2)
#define CONCATENATE1(arg1, arg2)  CONCATENATE2(arg1, arg2)
#define CONCATENATE2(arg1, arg2)  arg1##arg2

#define FOR_EACH_1(what, x, ...) what(x)
#define FOR_EACH_2(what, x, ...)\
  what(x);\
  FOR_EACH_1(what,  __VA_ARGS__);
#define FOR_EACH_3(what, x, ...)\
  what(x);\
  FOR_EACH_2(what, __VA_ARGS__);
#define FOR_EACH_4(what, x, ...)\
  what(x);\
  FOR_EACH_3(what,  __VA_ARGS__);
#define FOR_EACH_5(what, x, ...)\
  what(x);\
 FOR_EACH_4(what,  __VA_ARGS__);
#define FOR_EACH_6(what, x, ...)\
  what(x);\
  FOR_EACH_5(what,  __VA_ARGS__);
#define FOR_EACH_7(what, x, ...)\
  what(x);\
  FOR_EACH_6(what,  __VA_ARGS__);
#define FOR_EACH_8(what, x, ...)\
  what(x);\
  FOR_EACH_7(what,  __VA_ARGS__);

#define FOR_EACH_NARG(...) FOR_EACH_NARG_(__VA_ARGS__, FOR_EACH_RSEQ_N())
#define FOR_EACH_NARG_(...) FOR_EACH_ARG_N(__VA_ARGS__) 
#define FOR_EACH_ARG_N(_1, _2, _3, _4, _5, _6, _7, _8, N, ...) N 
#define FOR_EACH_RSEQ_N() 8, 7, 6, 5, 4, 3, 2, 1, 0

#define FOR_EACH_(N, what, x, ...) CONCATENATE(FOR_EACH_, N)(what, x, __VA_ARGS__)
#define FOR_EACH(what, x, ...) FOR_EACH_(FOR_EACH_NARG(x, __VA_ARGS__), what, x, __VA_ARGS__)

#define PRN_STRUCT_OFFSETS_(structure, field) printf(STRINGIZE(structure)":"STRINGIZE(field)" - offset = %d\n", offsetof(structure, field));
#define PRN_STRUCT_OFFSETS(field) PRN_STRUCT_OFFSETS_(struct termios, field)

#include <unistd.h>
#include <emscripten.h>

struct test
{
  char *a[5];
  char **b;
};


int main(int argc, char **argv) {
  printf("int: %lu\n", sizeof(int));
  printf("char: %lu\n", sizeof(char));
  printf("void*: %lu\n", sizeof(void*));
  printf("FP: %lu\n", sizeof( void(*)(void) ));
  INTRO();

  STRUCT_SHAPE(
    "termios",
    struct termios,
    EX(struct termios, c_iflag)
    EX(struct termios, c_oflag)
    EX(struct termios, c_cflag)
    EX(struct termios, c_lflag)
    EX(struct termios, c_line)
    EX(struct termios, c_cc)
  );

  STRUCT_SHAPE(
    "winsize",
    struct winsize,
    EX(struct winsize, ws_col)
    EX(struct winsize, ws_row)
    EX(struct winsize, ws_xpixel)
    EX(struct winsize, ws_ypixel)
  );

  STRUCT_SHAPE(
    "test",
    struct test,
    EX(struct test, a)
    EX(struct test, b)
  );
   
  FOR_EACH(PRN_STRUCT_OFFSETS, c_iflag, c_oflag, c_cflag, c_lflag, c_line, c_cc);

  printf("sbrk: %d\n", sbrk(0));
  EM_ASM(
    console.log(Module.HEAP8.length);
  );
}
