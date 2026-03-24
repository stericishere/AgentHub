import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import BudgetCard from '../../src/components/cost/BudgetCard.vue';

describe('BudgetCard', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders the label prop as visible text', () => {
    const wrapper = mount(BudgetCard, {
      props: {
        label: 'Monthly Budget',
        used: 125000,
        limit: 1000000,
        pct: 12.5,
        alertLevel: 'normal',
        mode: 'tokens',
      },
    });

    expect(wrapper.text()).toContain('Monthly Budget');
  });

  it('formats the used and limit values as tokens by default', () => {
    const wrapper = mount(BudgetCard, {
      props: {
        label: 'Daily Spend',
        used: 71000,
        limit: 500000,
        pct: 14.2,
        alertLevel: 'normal',
        mode: 'tokens',
      },
    });

    expect(wrapper.text()).toContain('71K 已使用');
    expect(wrapper.text()).toContain('500K 上限');
  });

  it('formats values as USD when mode is usd', () => {
    const wrapper = mount(BudgetCard, {
      props: {
        label: 'Daily Spend',
        used: 7.1,
        limit: 50.0,
        pct: 14.2,
        alertLevel: 'normal',
        mode: 'usd',
      },
    });

    expect(wrapper.text()).toContain('$7.10 已使用');
    expect(wrapper.text()).toContain('$50.00 上限');
  });

  it('displays the percentage value formatted to one decimal place', () => {
    const wrapper = mount(BudgetCard, {
      props: {
        label: 'Budget',
        used: 300000,
        limit: 1000000,
        pct: 30.0,
        alertLevel: 'normal',
      },
    });

    expect(wrapper.text()).toContain('30.0%');
  });

  it('applies warning colour classes when alertLevel is warning', () => {
    const wrapper = mount(BudgetCard, {
      props: {
        label: 'Budget',
        used: 375000,
        limit: 500000,
        pct: 75,
        alertLevel: 'warning',
      },
    });

    // The progress bar inner div should carry bg-warning
    const bar = wrapper.find('[style*="width"]');
    expect(bar.classes()).toContain('bg-warning');

    // The percentage text should be text-warning
    const pctSpan = wrapper.find('span.text-warning');
    expect(pctSpan.exists()).toBe(true);
  });

  it('applies danger colour classes when alertLevel is critical', () => {
    const wrapper = mount(BudgetCard, {
      props: {
        label: 'Budget',
        used: 460000,
        limit: 500000,
        pct: 92,
        alertLevel: 'critical',
      },
    });

    const bar = wrapper.find('[style*="width"]');
    expect(bar.classes()).toContain('bg-danger');

    const pctSpan = wrapper.find('span.text-danger');
    expect(pctSpan.exists()).toBe(true);
  });
});
