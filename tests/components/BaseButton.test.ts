import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import BaseButton from '../../src/components/common/BaseButton.vue';

describe('BaseButton', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it.each([
    ['primary', 'bg-accent'],
    ['secondary', 'bg-bg-hover'],
    ['ghost', 'bg-transparent'],
    ['icon', 'h-[34px]'],
    ['success', 'bg-success'],
    ['danger', 'bg-danger'],
  ] as const)('variant "%s" applies the expected class "%s"', (variant, expectedClass) => {
    const wrapper = mount(BaseButton, {
      props: { variant },
    });

    expect(wrapper.find('button').classes().join(' ')).toContain(expectedClass);
  });

  it('defaults to ghost variant when no variant prop is provided', () => {
    const wrapper = mount(BaseButton);

    const btn = wrapper.find('button');
    // Ghost variant uses bg-transparent
    expect(btn.classes()).toContain('bg-transparent');
  });

  it('applies small size classes when size is "sm"', () => {
    const wrapper = mount(BaseButton, {
      props: { size: 'sm' },
    });

    const btn = wrapper.find('button');
    // sm size: px-2.5 py-[5px] text-xs
    expect(btn.classes()).toContain('px-2.5');
    expect(btn.classes()).toContain('text-xs');
  });

  it('applies default size classes when size prop is omitted', () => {
    const wrapper = mount(BaseButton);

    const btn = wrapper.find('button');
    // default size: px-4 py-2 text-[13px]
    expect(btn.classes()).toContain('px-4');
    expect(btn.classes()).toContain('py-2');
  });

  it('renders slot content inside the button', () => {
    const wrapper = mount(BaseButton, {
      slots: { default: 'Click me' },
    });

    expect(wrapper.find('button').text()).toBe('Click me');
  });

  it('handles click interaction', async () => {
    let clicked = false;
    const wrapper = mount(BaseButton, {
      props: { variant: 'primary' },
      slots: { default: 'Submit' },
      attrs: { onClick: () => { clicked = true; } },
    });

    const button = wrapper.find('button').element as HTMLButtonElement;
    button.click();

    expect(clicked).toBe(true);
  });
});
